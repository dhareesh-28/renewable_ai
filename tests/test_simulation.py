"""Unit tests for closed-loop simulation pipeline (src/simulation.py)."""

import numpy as np
import pandas as pd
import pytest

from src.config import BatteryConfig, SystemConfig
from src.data_generator import generate_dataset
from src.forecasting import load_model
from src.simulation import get_24h_forecast, run_all_strategies, run_period, run_simulation


@pytest.fixture(scope="module")
def energy_df() -> pd.DataFrame:
    """Load or generate master energy dataset."""
    config = SystemConfig()
    csv_path = config.data_dir / "energy_data.csv"
    if csv_path.exists():
        return pd.read_csv(csv_path)
    return generate_dataset(config)


@pytest.fixture(scope="module")
def sample_horizon(energy_df: pd.DataFrame) -> pd.DataFrame:
    """Extract a 48-hour representative slice for simulation tests."""
    return energy_df.iloc[100:148].copy().reset_index(drop=True)


def test_summary_numbers_internal_consistency(sample_horizon: pd.DataFrame) -> None:
    """Verify mathematical consistency of simulation summary metrics."""
    config = SystemConfig()
    _, summary = run_simulation(sample_horizon, strategy="optimised_lp", config=config)

    total_cost = summary["total_cost"]
    grid_only_cost = summary["grid_only_cost"]
    savings_amount = summary["savings_amount"]
    savings_percent = summary["savings_percent"]

    # Verify: savings_amount = grid_only_cost - total_cost
    expected_savings = round(grid_only_cost - total_cost, 2)
    assert np.isclose(savings_amount, expected_savings, atol=0.02), (
        f"Savings amount {savings_amount} differs from expected {expected_savings}"
    )

    # Verify: savings_percent = (savings_amount / grid_only_cost) * 100
    if abs(grid_only_cost) > 1e-4:
        expected_pct = round((savings_amount / grid_only_cost) * 100.0, 2)
        assert np.isclose(savings_percent, expected_pct, atol=0.05), (
            f"Savings percent {savings_percent} differs from expected {expected_pct}"
        )


def test_no_data_leakage(sample_horizon: pd.DataFrame) -> None:
    """Verify model strictly predicts using weather features without accessing actual solar."""
    config = SystemConfig()
    forecast_model = load_model(config=config)

    df_original = sample_horizon.copy()
    res1, _ = run_simulation(df_original, forecast_model=forecast_model, config=config)
    preds1 = res1["solar_kw_predicted"].to_numpy()

    # Artificially tamper with solar_kw_actual (multiply by 10 or zero out)
    df_tampered = sample_horizon.copy()
    df_tampered["solar_kw_actual"] = df_tampered["solar_kw_actual"] * 10.0 + 5.0
    res2, _ = run_simulation(df_tampered, forecast_model=forecast_model, config=config)
    preds2 = res2["solar_kw_predicted"].to_numpy()

    # Predictions must remain bitwise identical despite drastically altered actual solar
    np.testing.assert_array_equal(
        preds1,
        preds2,
        err_msg="Data leakage detected! Forecast predictions changed when solar_kw_actual was modified.",
    )


def test_energy_balance_closed_loop(sample_horizon: pd.DataFrame) -> None:
    """Verify that hourly energy balance holds with real solar and grid flows."""
    config = SystemConfig()
    res_df, _ = run_simulation(sample_horizon, strategy="optimised_lp", config=config)

    supply = res_df["solar_kw_actual"] + res_df["grid_import_kw"] + res_df["battery_discharge_kw"]
    demand = res_df["building_load_kw"] + res_df["grid_export_kw"] + res_df["battery_charge_kw"]

    mismatch = np.abs(supply - demand)
    assert np.max(mismatch) < 1e-4, f"Closed-loop energy balance violated (max mismatch: {np.max(mismatch)})"


def test_run_all_strategies_structure(sample_horizon: pd.DataFrame) -> None:
    """Verify run_all_strategies returns results for all three dispatch approaches."""
    all_res = run_all_strategies(sample_horizon)
    assert "grid_only" in all_res
    assert "rule_based" in all_res
    assert "optimised_lp" in all_res

    for key, (df_res, summary) in all_res.items():
        assert len(df_res) == len(sample_horizon)
        assert "total_cost" in summary
        assert "savings_amount" in summary


def test_get_24h_forecast(energy_df: pd.DataFrame) -> None:
    """Verify get_24h_forecast produces a valid next-day plan."""
    start_time = energy_df.iloc[50]["timestamp"]
    fc = get_24h_forecast(energy_df, start_timestamp=start_time)

    assert fc["hours"] == 24
    assert len(fc["predicted_solar_kw"]) == 24
    assert len(fc["building_load_kw"]) == 24
    assert "recommended_schedule" in fc
    assert len(fc["recommended_schedule"]["battery_charge_kw"]) == 24
    assert len(fc["recommended_schedule"]["battery_discharge_kw"]) == 24
    assert len(fc["recommended_schedule"]["battery_soc_kwh"]) == 24


def test_run_period_monthly_breakdown(energy_df: pd.DataFrame) -> None:
    """Verify run_period executes and returns monthly comparative statistics."""
    period_df = run_period(energy_df.iloc[:24 * 60], granularity="month")
    assert len(period_df) >= 2
    expected_cols = [
        "period",
        "solar_kwh",
        "load_kwh",
        "grid_only_cost",
        "rule_based_cost",
        "optimised_cost",
        "savings_opt_pct",
    ]
    for col in expected_cols:
        assert col in period_df.columns

