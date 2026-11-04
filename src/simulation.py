"""Full closed-loop microgrid simulation engine.

Integrates PV generation forecasting, real-time fault detection, battery dispatch
scheduling, and financial billing accounting under dynamic Time-of-Use tariffs.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Optional, Union

# Ensure project root is in sys.path when executed directly
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

# Ensure UTF-8 output encoding on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error

from src.battery_optimizer import (
    strategy_grid_only,
    strategy_optimised_lp,
    strategy_rule_based,
)
from src.config import BatteryConfig, SystemConfig
from src.fault_detection import detect_faults
from src.forecasting import load_model, predict


def run_simulation(
    df_horizon: pd.DataFrame,
    strategy: str = "optimised_lp",
    battery_config: Optional[BatteryConfig] = None,
    forecast_model: Optional[Any] = None,
    iso_model: Optional[Any] = None,
    config: Optional[SystemConfig] = None,
    initial_soc_kwh: Optional[float] = None,
    precomputed_predictions: Optional[np.ndarray] = None,
    precomputed_faults: Optional[pd.DataFrame] = None,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Execute closed-loop simulation over the specified time horizon.

    Workflow:
    1. Predict solar generation with the trained ML model using only weather/temporal
       features (strictly without data leakage from solar_kw_actual).
    2. Run fault detection by comparing predicted vs measured solar generation.
    3. Plan battery dispatch schedule using PREDICTED solar and building load.
    4. Apply the planned dispatch in real-world operation and evaluate financial costs
       using ACTUAL measured solar generation for true grid import/export balances.

    Args:
        df_horizon: DataFrame slice containing required hourly features and actuals.
        strategy: Dispatch strategy ('grid_only', 'rule_based', 'optimised_lp').
        battery_config: Optional custom BatteryConfig to override system defaults.
        forecast_model: Pre-trained forecasting regressor (loaded from disk if None).
        iso_model: Pre-trained IsolationForest detector (loaded/trained if None).
        config: SystemConfig instance.
        initial_soc_kwh: Initial battery energy in kWh (defaults to config).

    Returns:
        Tuple of (results_df, summary_dict).
    """
    if config is None:
        config = SystemConfig()
    if battery_config is not None:
        # Override battery settings
        config.battery = battery_config

    if forecast_model is None:
        forecast_model = load_model(config=config)

    T = len(df_horizon)
    hour_arr = df_horizon["hour"].to_numpy().astype(int)
    grid_prices = np.array([config.tariff.get_import_price(h) for h in hour_arr], dtype=float)
    export_price = config.tariff.export_price

    # 1. Solar Forecasting (Strictly using features only: no data leakage)
    if precomputed_predictions is not None:
        predicted_solar_kw = precomputed_predictions
    else:
        predicted_solar_kw = predict(forecast_model, df_horizon, config)
    load_kw = df_horizon["building_load_kw"].to_numpy().astype(float)
    actual_solar_kw = df_horizon["solar_kw_actual"].to_numpy().astype(float)

    # 2. Fault Detection (Compares predicted vs actual)
    if precomputed_faults is not None:
        diagnosed_df = precomputed_faults
    else:
        diagnosed_df = detect_faults(
            df_horizon, forecast_model=forecast_model, iso_model=iso_model, config=config
        )
    is_fault_detected = diagnosed_df["final_fault"].to_numpy()
    fault_severities = diagnosed_df["severity"].to_list()
    fault_hours_detected = int(np.sum(is_fault_detected))

    # 3. Plan Battery Dispatch using PREDICTED Solar and Load
    init_soc = config.battery.initial_soc_kwh if initial_soc_kwh is None else initial_soc_kwh

    if strategy == "grid_only":
        plan = strategy_grid_only(predicted_solar_kw, load_kw, grid_prices, config)
    elif strategy == "rule_based":
        plan = strategy_rule_based(predicted_solar_kw, load_kw, grid_prices, config, initial_soc_kwh=init_soc)
    elif strategy == "optimised_lp":
        plan = strategy_optimised_lp(predicted_solar_kw, load_kw, grid_prices, config, initial_soc_kwh=init_soc)
    else:
        raise ValueError(
            f"Unknown dispatch strategy '{strategy}'. Valid: ['grid_only', 'rule_based', 'optimised_lp']"
        )

    planned_charge = plan.battery_charge_kw
    planned_discharge = plan.battery_discharge_kw
    soc_kwh = plan.soc_kwh

    # 4. Closed-Loop Real-World Evaluation: Execute plan against ACTUAL solar
    # Fair execution rule (Step 12-B):
    # Planned charge and discharge profiles from the forecasting phase are applied directly.
    # Any real-time generation surplus (actual > predicted) or deficit (actual < predicted)
    # is absorbed or supplied by the grid:
    #   solar_actual + grid_import + discharge = load + grid_export + charge
    #   => grid_import - grid_export = (load - solar_actual) + planned_charge - planned_discharge
    actual_net_grid = (load_kw - actual_solar_kw) + planned_charge - planned_discharge

    real_grid_import_kw = np.maximum(0.0, actual_net_grid)
    real_grid_export_kw = np.maximum(0.0, -actual_net_grid)

    hourly_cost = real_grid_import_kw * grid_prices - real_grid_export_kw * export_price
    total_cost = float(np.sum(hourly_cost))

    # Compute reference Grid-Only baseline on actual solar for fair financial benchmarking
    baseline_net_grid = load_kw - actual_solar_kw
    baseline_import_kw = np.maximum(0.0, baseline_net_grid)
    baseline_export_kw = np.maximum(0.0, -baseline_net_grid)
    baseline_hourly_cost = baseline_import_kw * grid_prices - baseline_export_kw * export_price
    grid_only_cost = float(np.sum(baseline_hourly_cost))

    savings_amount = grid_only_cost - total_cost
    savings_percent = (
        (savings_amount / grid_only_cost) * 100.0 if abs(grid_only_cost) > 1e-4 else 0.0
    )

    # Solar self-consumption %: (Generated Solar - Exported Solar) / Generated Solar
    total_solar_gen = float(np.sum(actual_solar_kw))
    total_export = float(np.sum(real_grid_export_kw))
    if total_solar_gen > 1e-4:
        self_consumption_pct = max(0.0, (total_solar_gen - total_export) / total_solar_gen) * 100.0
    else:
        self_consumption_pct = 0.0

    # Battery throughput cycles: total throughput / (2 * capacity)
    total_throughput = float(np.sum(planned_charge) + np.sum(planned_discharge))
    battery_cycles = total_throughput / (2.0 * config.battery.capacity_kwh)

    # Forecast MAE over horizon
    forecast_mae = float(mean_absolute_error(actual_solar_kw, predicted_solar_kw))

    # Assemble comprehensive results DataFrame
    results_df = pd.DataFrame(
        {
            "timestamp": df_horizon["timestamp"].to_numpy(),
            "hour": hour_arr,
            "solar_kw_actual": np.round(actual_solar_kw, 3),
            "solar_kw_predicted": np.round(predicted_solar_kw, 3),
            "building_load_kw": np.round(load_kw, 3),
            "is_fault_actual": df_horizon["is_fault"].to_numpy() if "is_fault" in df_horizon.columns else np.zeros(T, dtype=int),
            "is_fault_detected": is_fault_detected.astype(int),
            "fault_severity": fault_severities,
            "battery_charge_kw": np.round(planned_charge, 3),
            "battery_discharge_kw": np.round(planned_discharge, 3),
            "battery_soc_kwh": np.round(soc_kwh, 3),
            "grid_import_kw": np.round(real_grid_import_kw, 3),
            "grid_export_kw": np.round(real_grid_export_kw, 3),
            "electricity_cost": np.round(hourly_cost, 3),
            "grid_price_per_kwh": np.round(grid_prices, 2),
        }
    )

    summary_dict = {
        "strategy": strategy,
        "strategy_name": plan.strategy_name,
        "total_cost": round(total_cost, 2),
        "grid_only_cost": round(grid_only_cost, 2),
        "savings_amount": round(savings_amount, 2),
        "savings_percent": round(savings_percent, 2),
        "grid_import_kwh": round(float(np.sum(real_grid_import_kw)), 2),
        "grid_export_kwh": round(float(np.sum(real_grid_export_kw)), 2),
        "solar_generation_kwh": round(total_solar_gen, 2),
        "building_load_kwh": round(float(np.sum(load_kw)), 2),
        "solar_self_consumption_percent": round(self_consumption_pct, 2),
        "battery_cycles": round(battery_cycles, 3),
        "fault_hours_detected": fault_hours_detected,
        "forecast_mae": round(forecast_mae, 4),
        "currency": config.tariff.currency,
    }

    return results_df, summary_dict


def run_all_strategies(
    df_horizon: pd.DataFrame,
    battery_config: Optional[BatteryConfig] = None,
    forecast_model: Optional[Any] = None,
    iso_model: Optional[Any] = None,
    config: Optional[SystemConfig] = None,
    initial_soc_kwh: Optional[float] = None,
) -> dict[str, tuple[pd.DataFrame, dict[str, Any]]]:
    """Execute all three dispatch strategies across the identical horizon.

    Args:
        df_horizon: DataFrame slice for the horizon.
        battery_config: Optional custom BatteryConfig.
        forecast_model: Pre-trained forecasting regressor.
        iso_model: Pre-trained IsolationForest detector.
        config: SystemConfig instance.
        initial_soc_kwh: Initial SoC in kWh.

    Returns:
        Dictionary mapping strategy key ('grid_only', 'rule_based', 'optimised_lp')
        to its (results_df, summary_dict) tuple.
    """
    if config is None:
        config = SystemConfig()

    if forecast_model is None:
        forecast_model = load_model(config=config)

    if iso_model is None:
        iso_path = config.models_dir / "isolation_forest.joblib"
        if iso_path.exists():
            import joblib
            iso_model = joblib.load(iso_path)

    # Precompute predictions and fault diagnosis once across the shared horizon
    precomputed_preds = predict(forecast_model, df_horizon, config)
    precomputed_flts = detect_faults(
        df_horizon, forecast_model=forecast_model, iso_model=iso_model, config=config
    )

    strategies = ["grid_only", "rule_based", "optimised_lp"]
    all_results: dict[str, tuple[pd.DataFrame, dict[str, Any]]] = {}

    for strat in strategies:
        res_df, summary = run_simulation(
            df_horizon=df_horizon,
            strategy=strat,
            battery_config=battery_config,
            forecast_model=forecast_model,
            iso_model=iso_model,
            config=config,
            initial_soc_kwh=initial_soc_kwh,
            precomputed_predictions=precomputed_preds,
            precomputed_faults=precomputed_flts,
        )
        all_results[strat] = (res_df, summary)

    return all_results


def get_24h_forecast(
    df: pd.DataFrame,
    start_timestamp: Union[str, pd.Timestamp],
    forecast_model: Optional[Any] = None,
    iso_model: Optional[Any] = None,
    config: Optional[SystemConfig] = None,
) -> dict[str, Any]:
    """Retrieve 24-hour meteorological forecast, load, and recommended battery dispatch.

    Args:
        df: Master hourly DataFrame.
        start_timestamp: Starting ISO timestamp string or Timestamp.
        forecast_model: Optional pre-loaded forecasting regressor.
        iso_model: Optional pre-loaded IsolationForest detector.
        config: SystemConfig instance.

    Returns:
        Dictionary containing next-24h forecasts, recommended schedule, and summary.
    """
    if config is None:
        config = SystemConfig()

    start_str = str(start_timestamp)
    match_indices = df[df["timestamp"] == start_str].index
    if len(match_indices) == 0:
        # Fallback to nearest or first 24 hours
        start_idx = 0
    else:
        start_idx = int(match_indices[0])

    end_idx = min(len(df), start_idx + 24)
    slice_24h = df.iloc[start_idx:end_idx].copy().reset_index(drop=True)

    res_df, summary = run_simulation(
        df_horizon=slice_24h,
        strategy="optimised_lp",
        forecast_model=forecast_model,
        iso_model=iso_model,
        config=config,
    )

    return {
        "start_timestamp": str(slice_24h.iloc[0]["timestamp"]),
        "end_timestamp": str(slice_24h.iloc[-1]["timestamp"]),
        "hours": 24,
        "predicted_solar_kw": res_df["solar_kw_predicted"].tolist(),
        "building_load_kw": res_df["building_load_kw"].tolist(),
        "recommended_schedule": {
            "battery_charge_kw": res_df["battery_charge_kw"].tolist(),
            "battery_discharge_kw": res_df["battery_discharge_kw"].tolist(),
            "battery_soc_kwh": res_df["battery_soc_kwh"].tolist(),
            "grid_import_kw": res_df["grid_import_kw"].tolist(),
            "grid_export_kw": res_df["grid_export_kw"].tolist(),
            "expected_cost": summary["total_cost"],
        },
        "forecast_table": res_df,
        "summary": summary,
    }


def run_period(
    df: pd.DataFrame,
    start: Optional[Union[str, pd.Timestamp]] = None,
    end: Optional[Union[str, pd.Timestamp]] = None,
    granularity: str = "month",
    forecast_model: Optional[Any] = None,
    iso_model: Optional[Any] = None,
    config: Optional[SystemConfig] = None,
) -> pd.DataFrame:
    """Run chronological batch simulations grouped by time granularity (e.g., monthly).

    Args:
        df: Full hourly energy dataset.
        start: Optional start timestamp.
        end: Optional end timestamp.
        granularity: Aggregation period ('month', 'week').
        forecast_model: Pre-trained forecasting regressor.
        iso_model: Pre-trained IsolationForest detector.
        config: SystemConfig instance.

    Returns:
        pd.DataFrame containing monthly comparative performance across strategies.
    """
    if config is None:
        config = SystemConfig()

    df_period = df.copy()
    if start is not None:
        df_period = df_period[df_period["timestamp"] >= str(start)]
    if end is not None:
        df_period = df_period[df_period["timestamp"] <= str(end)]

    df_period = df_period.reset_index(drop=True)
    timestamps = pd.to_datetime(df_period["timestamp"])
    df_period["period_group"] = timestamps.dt.strftime("%Y-%m" if granularity == "month" else "%Y-W%W")

    period_rows: list[dict[str, Any]] = []
    groups = df_period.groupby("period_group", sort=False)

    for group_name, group_df in groups:
        all_strat_res = run_all_strategies(
            group_df,
            forecast_model=forecast_model,
            iso_model=iso_model,
            config=config,
        )

        s_grid = all_strat_res["grid_only"][1]
        s_rule = all_strat_res["rule_based"][1]
        s_opt = all_strat_res["optimised_lp"][1]

        period_rows.append(
            {
                "period": group_name,
                "solar_kwh": s_opt["solar_generation_kwh"],
                "load_kwh": s_opt["building_load_kwh"],
                "grid_only_cost": s_grid["total_cost"],
                "rule_based_cost": s_rule["total_cost"],
                "optimised_cost": s_opt["total_cost"],
                "savings_rule_kwh": round(s_grid["total_cost"] - s_rule["total_cost"], 2),
                "savings_opt_kwh": round(s_grid["total_cost"] - s_opt["total_cost"], 2),
                "savings_opt_pct": s_opt["savings_percent"],
                "self_consumption_pct": s_opt["solar_self_consumption_percent"],
                "battery_cycles": s_opt["battery_cycles"],
                "fault_hours": s_opt["fault_hours_detected"],
            }
        )

    return pd.DataFrame(period_rows)


def main() -> None:
    """Run simulation on representative sunny, cloudy, and fault days and print side-by-side."""
    config = SystemConfig()
    csv_path = config.data_dir / "energy_data.csv"

    if not csv_path.exists():
        print(f"[Error] Missing dataset: {csv_path}. Run src/data_generator.py first.")
        sys.exit(1)

    df = pd.read_csv(csv_path)

    # Specific representative days identified in the dataset:
    # Sunny: Day 146 (2026-05-26), Solar ~54.3 kWh, Cloud ~0.08, Faults = 0
    # Cloudy: Day 275 (2026-10-02), Solar ~13.2 kWh, Cloud ~0.85, Faults = 0
    # Fault: Day 22 (2026-01-22), Solar ~15.2 kWh, Cloud ~0.28, Faults = 8
    sunny_slice = df.iloc[(146 - 1) * 24 : 146 * 24].copy().reset_index(drop=True)
    cloudy_slice = df.iloc[(275 - 1) * 24 : 275 * 24].copy().reset_index(drop=True)
    fault_slice = df.iloc[(22 - 1) * 24 : 22 * 24].copy().reset_index(drop=True)

    print("Executing closed-loop simulation on Sunny, Cloudy, and Fault days...")
    _, s_sunny = run_simulation(sunny_slice, strategy="optimised_lp", config=config)
    _, s_cloudy = run_simulation(cloudy_slice, strategy="optimised_lp", config=config)
    _, s_fault = run_simulation(fault_slice, strategy="optimised_lp", config=config)

    currency = config.tariff.currency

    print("\n" + "=" * 95)
    print("REPRESENTATIVE DAY SIMULATION COMPARISON (OPTIMISED LP STRATEGY)")
    print("=" * 95)
    print(
        f"{'Metric':<32} | {'Sunny Day (May 26)':<18} | {'Cloudy Day (Oct 02)':<18} | {'Fault Day (Jan 22)':<18}"
    )
    print("-" * 95)
    print(f"{'Solar Generation (kWh)':<32} | {s_sunny['solar_generation_kwh']:<18.2f} | {s_cloudy['solar_generation_kwh']:<18.2f} | {s_fault['solar_generation_kwh']:<18.2f}")
    print(f"{'Building Load (kWh)':<32} | {s_sunny['building_load_kwh']:<18.2f} | {s_cloudy['building_load_kwh']:<18.2f} | {s_fault['building_load_kwh']:<18.2f}")
    print(f"{'Grid Import (kWh)':<32} | {s_sunny['grid_import_kwh']:<18.2f} | {s_cloudy['grid_import_kwh']:<18.2f} | {s_fault['grid_import_kwh']:<18.2f}")
    print(f"{'Grid Export (kWh)':<32} | {s_sunny['grid_export_kwh']:<18.2f} | {s_cloudy['grid_export_kwh']:<18.2f} | {s_fault['grid_export_kwh']:<18.2f}")
    print(f"{'Grid-only Cost':<32} | {s_sunny['grid_only_cost']:<15.2f} {currency} | {s_cloudy['grid_only_cost']:<15.2f} {currency} | {s_fault['grid_only_cost']:<15.2f} {currency}")
    print(f"{'Optimised Cost':<32} | {s_sunny['total_cost']:<15.2f} {currency} | {s_cloudy['total_cost']:<15.2f} {currency} | {s_fault['total_cost']:<15.2f} {currency}")
    print(f"{'Cost Savings Amount':<32} | {s_sunny['savings_amount']:<15.2f} {currency} | {s_cloudy['savings_amount']:<15.2f} {currency} | {s_fault['savings_amount']:<15.2f} {currency}")
    print(f"{'Cost Savings (%)':<32} | {s_sunny['savings_percent']:<17.1f}% | {s_cloudy['savings_percent']:<17.1f}% | {s_fault['savings_percent']:<17.1f}%")
    print(f"{'Solar Self-Consumption (%)':<32} | {s_sunny['solar_self_consumption_percent']:<17.1f}% | {s_cloudy['solar_self_consumption_percent']:<17.1f}% | {s_fault['solar_self_consumption_percent']:<17.1f}%")
    print(f"{'Battery Cycles':<32} | {s_sunny['battery_cycles']:<18.3f} | {s_cloudy['battery_cycles']:<18.3f} | {s_fault['battery_cycles']:<18.3f}")
    print(f"{'Fault Hours Detected':<32} | {s_sunny['fault_hours_detected']:<18} | {s_cloudy['fault_hours_detected']:<18} | {s_fault['fault_hours_detected']:<18}")
    print(f"{'Forecast MAE (kW)':<32} | {s_sunny['forecast_mae']:<18.4f} | {s_cloudy['forecast_mae']:<18.4f} | {s_fault['forecast_mae']:<18.4f}")
    print("-" * 95)


if __name__ == "__main__":
    main()
