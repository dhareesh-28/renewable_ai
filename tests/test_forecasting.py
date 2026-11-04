"""Unit tests for solar forecasting module (src/forecasting.py)."""

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from src.config import SystemConfig
from src.data_generator import generate_dataset
from src.forecasting import (
    FEATURE_COLUMNS,
    feature_importance,
    load_model,
    predict,
    prepare_features,
    train_model,
)


@pytest.fixture(scope="module")
def energy_df() -> pd.DataFrame:
    """Generate or load the deterministic 365-day energy dataset."""
    config = SystemConfig()
    csv_path = config.data_dir / "energy_data.csv"
    if csv_path.exists():
        return pd.read_csv(csv_path)
    return generate_dataset(config)


@pytest.fixture(scope="module")
def trained_artifacts(energy_df: pd.DataFrame) -> tuple:
    """Train the model once for the test module."""
    config = SystemConfig()
    model, metrics = train_model(energy_df, config)
    return model, metrics, config


def test_prepare_features_structure(energy_df: pd.DataFrame) -> None:
    """Verify prepare_features produces exact expected columns including cyclical encodings."""
    X = prepare_features(energy_df)
    assert list(X.columns) == FEATURE_COLUMNS
    assert len(X) == len(energy_df)
    assert not X.isnull().values.any(), "Features must not contain NaN values"


def test_model_beats_naive_baseline(trained_artifacts: tuple) -> None:
    """Verify that the Random Forest model achieves lower MAE than the 24h naive baseline."""
    _, metrics, _ = trained_artifacts
    model_mae = metrics["model_metrics"]["mae"]
    naive_mae = metrics["baseline_metrics"]["mae"]

    assert metrics["evaluation_summary"]["model_beats_baseline"] is True
    assert model_mae < naive_mae, (
        f"Model MAE ({model_mae}) must be lower than naive baseline MAE ({naive_mae})"
    )


def test_predictions_within_physical_capacity(
    trained_artifacts: tuple, energy_df: pd.DataFrame
) -> None:
    """Verify all model predictions stay strictly within [0, capacity_kwp]."""
    model, _, config = trained_artifacts
    preds = predict(model, energy_df, config)

    assert preds.min() >= 0.0, f"Predicted solar power cannot be negative, got {preds.min()}"
    assert preds.max() <= config.solar.capacity_kwp, (
        f"Predicted solar power ({preds.max()}) exceeded capacity ({config.solar.capacity_kwp})"
    )


def test_predictions_zero_at_night(
    trained_artifacts: tuple, energy_df: pd.DataFrame
) -> None:
    """Verify predictions are strictly 0.0 during night hours (when irradiance is 0)."""
    model, _, config = trained_artifacts
    night_mask = energy_df["irradiance_wm2"] == 0.0
    assert night_mask.sum() > 0, "Expected nighttime hours in dataset"

    night_subset = energy_df[night_mask]
    night_preds = predict(model, night_subset, config)

    assert np.all(night_preds == 0.0), (
        f"Expected all night predictions to be 0.0, but max was {night_preds.max()}"
    )


def test_feature_importance_format(trained_artifacts: tuple) -> None:
    """Verify feature importances are properly computed and sum to ~1.0."""
    model, _, _ = trained_artifacts
    fi_df = feature_importance(model, FEATURE_COLUMNS)

    assert list(fi_df.columns) == ["feature", "importance"]
    assert len(fi_df) == len(FEATURE_COLUMNS)
    assert np.isclose(fi_df["importance"].sum(), 1.0, atol=1e-2)
    # Irradiance is the physical primary driver of solar generation
    top_feature = fi_df.iloc[0]["feature"]
    assert top_feature == "irradiance_wm2", f"Expected top feature to be irradiance_wm2, got {top_feature}"


def test_model_persistence_and_metrics_file(trained_artifacts: tuple) -> None:
    """Verify model can be reloaded and JSON metrics file contains required fields."""
    _, metrics, config = trained_artifacts
    model_file = config.models_dir / "solar_rf.joblib"
    metrics_file = config.models_dir / "forecast_metrics.json"

    assert model_file.exists(), f"Model file missing: {model_file}"
    assert metrics_file.exists(), f"Metrics file missing: {metrics_file}"

    # Verify reloading
    reloaded_model = load_model(model_file, config)
    assert hasattr(reloaded_model, "predict")

    # Verify JSON structure
    with open(metrics_file, "r", encoding="utf-8") as f:
        saved_metrics = json.load(f)

    assert "model_metrics" in saved_metrics
    assert "baseline_metrics" in saved_metrics
    assert "feature_importances" in saved_metrics
    assert "test_samples" in saved_metrics
    assert len(saved_metrics["test_samples"]) <= config.forecast.sample_size_eval

