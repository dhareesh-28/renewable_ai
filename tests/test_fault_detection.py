"""Unit tests for PV fault and anomaly detection module (src/fault_detection.py)."""

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from src.config import SystemConfig
from src.data_generator import generate_dataset
from src.fault_detection import (
    detect_faults,
    detect_faults_method_a,
    detect_faults_method_b,
    evaluate_fault_detection,
    extract_fault_events,
    train_isolation_forest,
)
from src.forecasting import load_model, predict


@pytest.fixture(scope="module")
def energy_df() -> pd.DataFrame:
    """Load or generate the 365-day energy dataset."""
    config = SystemConfig()
    csv_path = config.data_dir / "energy_data.csv"
    if csv_path.exists():
        return pd.read_csv(csv_path)
    return generate_dataset(config)


@pytest.fixture(scope="module")
def forecast_model():
    """Load pre-trained solar forecasting model."""
    config = SystemConfig()
    return load_model(config=config)


def test_no_flags_at_night(energy_df: pd.DataFrame, forecast_model) -> None:
    """Verify that neither Method A nor Method B ever flags anomalies at night."""
    config = SystemConfig()
    diagnosed_df = detect_faults(energy_df, forecast_model=forecast_model, config=config)

    night_mask = diagnosed_df["irradiance_wm2"] == 0.0
    assert night_mask.sum() > 0, "Expected nighttime hours in test dataset"

    night_df = diagnosed_df[night_mask]
    assert night_df["fault_method_a"].sum() == 0, "Method A must never flag nighttime hours"
    assert night_df["fault_method_b"].sum() == 0, "Method B must never flag nighttime hours"
    assert night_df["final_fault"].sum() == 0, "Combined flag must be 0 at night"
    assert (night_df["severity"] == "None").all(), "Severity must be 'None' at night"


def test_near_zero_detections_on_fault_free_dataset(forecast_model) -> None:
    """Verify false alarm rate on a clean dataset with zero injected faults."""
    from src.config import FaultConfig

    # Generate a genuinely fault-free dataset
    clean_config = SystemConfig(fault=FaultConfig(fault_fraction=0.0))
    clean_df = generate_dataset(clean_config)

    split_idx = int(len(clean_df) * clean_config.data.train_fraction)
    test_clean = clean_df.iloc[split_idx:].copy().reset_index(drop=True)

    diagnosed = detect_faults(test_clean, forecast_model=forecast_model, config=clean_config)

    # Method A should have exactly 0 detections on genuinely fault-free data
    method_a_flags = diagnosed["fault_method_a"].sum()
    assert method_a_flags == 0, f"Expected 0 false alarms for Method A on healthy data, got {method_a_flags}"

    # Method B (Isolation Forest with 4% contamination) should flag very few points
    method_b_flags = diagnosed["fault_method_b"].sum()
    daytime_count = (test_clean["irradiance_wm2"] > clean_config.data.daytime_irradiance_threshold).sum()
    false_positive_rate_b = method_b_flags / max(1, daytime_count)
    assert false_positive_rate_b <= 0.06, (
        f"Isolation Forest FPR ({false_positive_rate_b:.3f}) exceeds reasonable bounds on clean data"
    )


def test_obviously_injected_zero_output_block_detected(
    energy_df: pd.DataFrame, forecast_model
) -> None:
    """Verify an obvious simulated inverter shutdown (output = 0 during midday) is detected."""
    config = SystemConfig()
    test_slice = energy_df.iloc[7000:7048].copy().reset_index(drop=True)

    # Find a clear midday window (e.g. 5 consecutive hours with irradiance > 600)
    high_sun = (test_slice["irradiance_wm2"] > 600.0) & (test_slice["hour"].between(10, 15))
    assert high_sun.sum() >= 4, "Expected at least 4 midday hours in test window"

    injected_indices = test_slice[high_sun].index[:4]
    # Artificially inject total inverter shutdown (solar = 0.0)
    test_slice.loc[injected_indices, "solar_kw_actual"] = 0.0
    test_slice.loc[injected_indices, "is_fault"] = 1

    diagnosed = detect_faults(test_slice, forecast_model=forecast_model, config=config)

    # Both Method A and Method B should detect this severe event
    for idx in injected_indices:
        assert diagnosed.loc[idx, "fault_method_a"] == 1, (
            f"Method A failed to detect obvious zero-generation at index {idx}"
        )
        assert diagnosed.loc[idx, "fault_method_b"] == 1, (
            f"Method B failed to detect obvious zero-generation at index {idx}"
        )
        assert diagnosed.loc[idx, "final_fault"] == 1
        assert diagnosed.loc[idx, "severity"] == "High", (
            f"Zero generation must receive 'High' severity, got {diagnosed.loc[idx, 'severity']}"
        )


def test_extracted_events_never_overlap(energy_df: pd.DataFrame, forecast_model) -> None:
    """Verify extracted fault events are strictly non-overlapping and chronologically ordered."""
    config = SystemConfig()
    diagnosed_df = detect_faults(energy_df, forecast_model=forecast_model, config=config)
    events = extract_fault_events(diagnosed_df)

    assert len(events) > 0, "Expected fault events to be detected"

    for i in range(len(events) - 1):
        curr_event = events[i]
        next_event = events[i + 1]

        curr_end = pd.to_datetime(curr_event["end"])
        next_start = pd.to_datetime(next_event["start"])

        assert curr_end < next_start, (
            f"Event {i} end ({curr_end}) is not strictly before Event {i+1} start ({next_start})"
        )
        assert curr_event["duration_h"] > 0
        assert curr_event["energy_lost_kwh"] >= 0.0
        assert curr_event["peak_residual_kw"] >= 0.0
        assert curr_event["severity"] in ["Low", "Medium", "High"]


def test_evaluation_metrics_and_artifacts(energy_df: pd.DataFrame) -> None:
    """Verify evaluation produces valid confusion matrices and JSON structure."""
    config = SystemConfig()
    _, metrics, events = evaluate_fault_detection(energy_df, config)

    metrics_file = config.models_dir / "fault_metrics.json"
    assert metrics_file.exists(), f"Metrics file {metrics_file} was not created"

    # Check Method A, B, and Combined keys
    for key in ["method_a_residual_threshold", "method_b_isolation_forest", "combined_hybrid"]:
        assert key in metrics
        m = metrics[key]
        assert "precision" in m
        assert "recall" in m
        assert "f1_score" in m
        assert "confusion_matrix" in m
        cm = m["confusion_matrix"]
        assert len(cm) == 2 and len(cm[0]) == 2 and len(cm[1]) == 2, "Confusion matrix must be 2x2"
