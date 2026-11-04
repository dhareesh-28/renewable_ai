"""Solar photovoltaic generation forecasting module.

Trains and evaluates a machine learning regressor (Random Forest) to predict solar
generation under healthy operating conditions, establishing the baseline expectation
required for subsequent anomaly/fault detection.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Optional, Union

# Ensure project root is in sys.path when executed directly
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

# Ensure UTF-8 output encoding on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from src.config import SystemConfig

# Explicit feature list for the solar forecasting model
FEATURE_COLUMNS = [
    "hour",
    "day_of_year",
    "month",
    "temperature_c",
    "irradiance_wm2",
    "cloud_cover",
    "hour_sin",
    "hour_cos",
    "day_sin",
    "day_cos",
]


def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
    """Generate cyclical trigonometric encodings and extract model features.

    Args:
        df: Input DataFrame containing hour, day_of_year, month, temperature_c,
            irradiance_wm2, and cloud_cover.

    Returns:
        DataFrame containing strictly the engineered FEATURE_COLUMNS.
    """
    df_feat = df.copy()

    # Cyclical hour encoding (period = 24 hours)
    if "hour_sin" not in df_feat.columns:
        df_feat["hour_sin"] = np.sin(2.0 * np.pi * df_feat["hour"] / 24.0)
    if "hour_cos" not in df_feat.columns:
        df_feat["hour_cos"] = np.cos(2.0 * np.pi * df_feat["hour"] / 24.0)

    # Cyclical day of year encoding (period = 365.25 days)
    if "day_sin" not in df_feat.columns:
        df_feat["day_sin"] = np.sin(2.0 * np.pi * df_feat["day_of_year"] / 365.25)
    if "day_cos" not in df_feat.columns:
        df_feat["day_cos"] = np.cos(2.0 * np.pi * df_feat["day_of_year"] / 365.25)

    return df_feat[FEATURE_COLUMNS]


def feature_importance(
    model: RandomForestRegressor,
    feature_names: Optional[list[str]] = None,
) -> pd.DataFrame:
    """Extract and sort feature importances from the trained Random Forest model.

    Args:
        model: Fitted RandomForestRegressor instance.
        feature_names: Optional list of feature names (defaults to FEATURE_COLUMNS).

    Returns:
        pd.DataFrame with 'feature' and 'importance' columns sorted descending.
    """
    if feature_names is None:
        feature_names = FEATURE_COLUMNS

    importances = model.feature_importances_
    fi_df = pd.DataFrame(
        {
            "feature": feature_names,
            "importance": np.round(importances, 5),
        }
    ).sort_values(by="importance", ascending=False).reset_index(drop=True)

    return fi_df


def predict(
    model: RandomForestRegressor,
    df_features: pd.DataFrame,
    config: Optional[SystemConfig] = None,
) -> np.ndarray:
    """Generate bounded solar generation predictions for input meteorological features.

    Predictions are strictly bounded:
    - Zero at night whenever irradiance_wm2 == 0.0
    - Non-negative and capped at config.solar.capacity_kwp

    Args:
        model: Trained RandomForestRegressor.
        df_features: DataFrame containing required raw or engineered feature columns.
        config: SystemConfig instance for physical bounds. If None, default is used.

    Returns:
        1D numpy array of predicted solar generation in kW.
    """
    if config is None:
        config = SystemConfig()

    X = prepare_features(df_features)
    raw_preds = model.predict(X)

    # Enforce physical constraints: non-negative and capped at capacity
    bounded_preds = np.clip(raw_preds, 0.0, config.solar.capacity_kwp)

    # Zero at night: if irradiance_wm2 is present, zero out nighttime predictions
    if "irradiance_wm2" in df_features.columns:
        irradiance = df_features["irradiance_wm2"].to_numpy()
        bounded_preds = np.where(irradiance <= 0.0, 0.0, bounded_preds)

    return np.round(bounded_preds, 3)


def load_model(
    model_path: Optional[Union[Path, str]] = None,
    config: Optional[SystemConfig] = None,
) -> RandomForestRegressor:
    """Load a previously serialized solar forecasting model from disk.

    Args:
        model_path: Optional path to the .joblib model file.
        config: SystemConfig instance used to resolve default models_dir if path is None.

    Returns:
        Fitted RandomForestRegressor instance.
    """
    if config is None:
        config = SystemConfig()

    target_path = Path(model_path) if model_path else config.models_dir / "solar_rf.joblib"
    if not target_path.exists():
        raise FileNotFoundError(f"Model file not found at: {target_path}")

    model = joblib.load(target_path)
    return model


def train_model(
    df: pd.DataFrame,
    config: Optional[SystemConfig] = None,
) -> tuple[RandomForestRegressor, dict]:
    """Train the Random Forest solar generation forecasting model on healthy data.

    Workflow:
    1. Filter out faulty observations (train ONLY on is_fault == 0).
    2. Split chronologically using config.data.train_fraction without shuffling.
    3. Train RandomForestRegressor with configured hyperparameters.
    4. Evaluate model vs. 24-hour persistence baseline (same hour yesterday) on held-out test data.
    5. Save model to models/solar_rf.joblib and metrics to models/forecast_metrics.json.

    Args:
        df: Hourly dataset DataFrame containing all meteorological and generation columns.
        config: SystemConfig instance. If None, default SystemConfig is used.

    Returns:
        Tuple of (trained_model, metrics_dict).
    """
    if config is None:
        config = SystemConfig()

    # Precompute naive baseline feature across full chronological time series:
    # 24-hour lag (same hour yesterday)
    df_eval = df.copy()
    df_eval["solar_kw_yesterday"] = df_eval["solar_kw_actual"].shift(24).fillna(0.0)

    # 1. Chronological Train/Test Split (Never shuffle)
    total_len = len(df_eval)
    split_idx = int(total_len * config.data.train_fraction)

    train_slice = df_eval.iloc[:split_idx]
    test_slice = df_eval.iloc[split_idx:]

    # 2. Filter ONLY healthy rows for model training and fair evaluation
    train_healthy = train_slice[train_slice["is_fault"] == 0].copy()
    test_healthy = test_slice[test_slice["is_fault"] == 0].copy()

    X_train = prepare_features(train_healthy)
    y_train = train_healthy["solar_kw_actual"].to_numpy()

    X_test = prepare_features(test_healthy)
    y_test = test_healthy["solar_kw_actual"].to_numpy()
    y_test_naive = test_healthy["solar_kw_yesterday"].to_numpy()

    # 3. Model Initialization and Training
    rf_cfg = config.forecast
    model = RandomForestRegressor(
        n_estimators=rf_cfg.n_estimators,
        max_depth=rf_cfg.max_depth,
        min_samples_leaf=rf_cfg.min_samples_leaf,
        n_jobs=rf_cfg.n_jobs,
        random_state=rf_cfg.random_state,
    )
    model.fit(X_train, y_train)

    # 4. Predictions on held-out test set
    y_pred = predict(model, test_healthy, config)

    # 5. Compute Metrics for Model
    model_mae = float(mean_absolute_error(y_test, y_pred))
    model_mse = float(mean_squared_error(y_test, y_pred))
    model_rmse = float(np.sqrt(model_mse))
    model_r2 = float(r2_score(y_test, y_pred))

    # 6. Compute Metrics for 24-Hour Naive Baseline
    naive_mae = float(mean_absolute_error(y_test, y_test_naive))
    naive_mse = float(mean_squared_error(y_test, y_test_naive))
    naive_rmse = float(np.sqrt(naive_mse))
    naive_r2 = float(r2_score(y_test, y_test_naive))

    mae_improvement_pct = ((naive_mae - model_mae) / naive_mae) * 100.0

    # 7. Extract Feature Importances
    fi_df = feature_importance(model, FEATURE_COLUMNS)
    fi_list = fi_df.to_dict(orient="records")

    # 8. Sample up to sample_size_eval test points for scatter plot visualization
    sample_size = min(rf_cfg.sample_size_eval, len(test_healthy))
    rng = np.random.default_rng(config.data.seed)
    sample_indices = rng.choice(len(test_healthy), size=sample_size, replace=False)
    sample_indices.sort()

    test_samples: list[dict] = []
    test_healthy_reset = test_healthy.reset_index(drop=True)
    for idx in sample_indices:
        row = test_healthy_reset.iloc[idx]
        test_samples.append(
            {
                "timestamp": str(row["timestamp"]),
                "hour": int(row["hour"]),
                "irradiance_wm2": float(row["irradiance_wm2"]),
                "actual": float(y_test[idx]),
                "predicted": float(y_pred[idx]),
                "naive": float(y_test_naive[idx]),
            }
        )

    metrics_payload = {
        "model_metrics": {
            "mae": round(model_mae, 4),
            "rmse": round(model_rmse, 4),
            "r2": round(model_r2, 4),
        },
        "baseline_metrics": {
            "mae": round(naive_mae, 4),
            "rmse": round(naive_rmse, 4),
            "r2": round(naive_r2, 4),
        },
        "evaluation_summary": {
            "train_samples_healthy": len(train_healthy),
            "test_samples_healthy": len(test_healthy),
            "mae_improvement_percent": round(mae_improvement_pct, 2),
            "model_beats_baseline": bool(model_mae < naive_mae),
        },
        "feature_importances": fi_list,
        "test_samples": test_samples,
    }

    # 9. Save Artifacts
    config.models_dir.mkdir(parents=True, exist_ok=True)
    model_save_path = config.models_dir / "solar_rf.joblib"
    metrics_save_path = config.models_dir / "forecast_metrics.json"

    joblib.dump(model, model_save_path)
    with open(metrics_save_path, "w", encoding="utf-8") as f:
        json.dump(metrics_payload, f, indent=2)

    return model, metrics_payload


def main() -> None:
    """Script entrypoint: load dataset, train Random Forest forecasting model, and report metrics."""
    config = SystemConfig()
    csv_path = config.data_dir / "energy_data.csv"

    if not csv_path.exists():
        print(f"[Error] Dataset not found at: {csv_path}. Please run src/data_generator.py first.")
        sys.exit(1)

    print(f"Loading energy dataset from {csv_path}...")
    df = pd.read_csv(csv_path)

    print("Training Random Forest solar forecasting regressor...")
    model, metrics = train_model(df, config)

    m = metrics["model_metrics"]
    b = metrics["baseline_metrics"]
    s = metrics["evaluation_summary"]

    print("\n" + "=" * 65)
    print("SOLAR FORECASTING PERFORMANCE EVALUATION")
    print("=" * 65)
    print(f"{'Metric':<10} | {'Random Forest Model':<22} | {'Naive Baseline (24h)':<22}")
    print("-" * 65)
    print(f"{'MAE (kW)':<10} | {m['mae']:<22.4f} | {b['mae']:<22.4f}")
    print(f"{'RMSE (kW)':<10} | {m['rmse']:<22.4f} | {b['rmse']:<22.4f}")
    print(f"{'R² Score':<10} | {m['r2']:<22.4f} | {b['r2']:<22.4f}")
    print("-" * 65)
    print(f"MAE Improvement over Baseline: {s['mae_improvement_percent']:.2f}%")
    print(f"Model beats baseline on MAE:   {'YES [PASSED]' if s['model_beats_baseline'] else 'NO [FAILED]'}")
    print(f"Healthy Training Samples:      {s['train_samples_healthy']}")
    print(f"Healthy Held-Out Test Samples: {s['test_samples_healthy']}")

    print("\n" + "=" * 65)
    print("TOP 5 FEATURE IMPORTANCES:")
    print("=" * 65)
    for item in metrics["feature_importances"][:5]:
        print(f"  - {item['feature']:<18}: {item['importance']:.4f}")

    print(f"\nModel serialized to:   {config.models_dir / 'solar_rf.joblib'}")
    print(f"Metrics serialized to: {config.models_dir / 'forecast_metrics.json'}")


if __name__ == "__main__":
    main()
