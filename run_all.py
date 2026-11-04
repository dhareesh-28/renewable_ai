"""Master pipeline script for AI-Based Renewable Energy Management System.

Executes data generation, model training, fault detection benchmarking,
and closed-loop battery dispatch simulation end-to-end.
"""

import sys
from pathlib import Path

# Ensure UTF-8 output encoding on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import numpy as np

from src.battery_optimizer import run_all_strategies as run_battery_strategies, verify_energy_balance, verify_soc_bounds
from src.config import SystemConfig
from src.data_generator import generate_dataset
from src.fault_detection import evaluate_fault_detection
from src.forecasting import train_model
from src.simulation import run_simulation


def main() -> None:
    """Run system configuration check and end-to-end pipeline."""
    print("=" * 65)
    print("AI-Based Renewable Energy Management and Optimisation System")
    print("=" * 65)

    config = SystemConfig()
    print(f"[Config] Solar PV Capacity: {config.solar.capacity_kwp} kWp (derate={config.solar.derate})")
    print(f"[Config] Battery Capacity:  {config.battery.capacity_kwh} kWh (max power={config.battery.max_power_kw} kW)")
    print(f"[Config] Tariff Currency:   {config.tariff.currency}")
    print(f"[Config] Simulation Days:   {config.data.days} days (seed={config.data.seed})")
    print(f"[Config] Fault Fraction:    {config.fault.fault_fraction * 100:.1f}%")

    print("\n[Step 2] Generating synthetic hourly energy dataset...")
    df = generate_dataset(config)
    csv_path = config.data_dir / "energy_data.csv"
    config.data_dir.mkdir(parents=True, exist_ok=True)
    df.to_csv(csv_path, index=False)
    print(f"[Step 2] Dataset successfully generated: {len(df)} rows saved to {csv_path}")

    daytime_df = df[df["irradiance_wm2"] > config.data.daytime_irradiance_threshold]
    fault_pct = (daytime_df["is_fault"].sum() / len(daytime_df)) * 100.0
    print(f"[Step 2] Daytime PV fault rate: {fault_pct:.2f}% (Target: {config.fault.fault_fraction * 100.0:.2f}%)")

    print("\n[Step 3] Training Random Forest solar forecasting regressor...")
    model, metrics = train_model(df, config)
    m = metrics["model_metrics"]
    b = metrics["baseline_metrics"]
    print(f"[Step 3] Model MAE: {m['mae']:.4f} kW (Baseline: {b['mae']:.4f} kW, Improvement: {metrics['evaluation_summary']['mae_improvement_percent']}%)")
    print(f"[Step 3] Model R²:  {m['r2']:.4f} (Baseline: {b['r2']:.4f})")

    print("\n[Step 4] Benchmarking fault detection algorithms (Test Period)...")
    _, fault_metrics, events = evaluate_fault_detection(df, config)
    fA = fault_metrics["method_a_residual_threshold"]
    fB = fault_metrics["method_b_isolation_forest"]
    fC = fault_metrics["combined_hybrid"]
    print(f"[Step 4] Method A (Threshold): Precision={fA['precision']:.3f}, Recall={fA['recall']:.3f}, F1={fA['f1_score']:.3f} (FP={fA['false_positives']})")
    print(f"[Step 4] Method B (IsoForest): Precision={fB['precision']:.3f}, Recall={fB['recall']:.3f}, F1={fB['f1_score']:.3f} (TP={fB['true_positives']})")
    print(f"[Step 4] Combined (A OR B):   Precision={fC['precision']:.3f}, Recall={fC['recall']:.3f}, F1={fC['f1_score']:.3f}")
    print(f"[Step 4] Extracted {len(events)} non-overlapping fault events ({fault_metrics['detected_events_summary']['total_energy_lost_kwh']} kWh lost)")

    print("\n[Step 5] Comparing battery dispatch strategies (Sample 24h Day)...")
    s_kw = np.array(
        [
            0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5, 1.5, 3.2, 5.0, 6.5, 7.0,
            6.5, 5.0, 3.2, 1.5, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
        ],
        dtype=float,
    )
    l_kw = np.array(
        [
            1.2, 1.1, 1.0, 1.0, 1.1, 1.3, 2.0, 2.5, 2.0, 1.8, 1.7, 1.8,
            1.9, 2.0, 2.2, 2.5, 3.0, 3.5, 4.0, 3.8, 3.2, 2.5, 1.8, 1.4,
        ],
        dtype=float,
    )
    p_arr = np.array([config.tariff.get_import_price(h) for h in range(24)], dtype=float)

    b_results = run_battery_strategies(s_kw, l_kw, p_arr, config)
    c_grid = b_results["grid_only"].total_cost
    c_rule = b_results["rule_based"].total_cost
    c_opt = b_results["optimised_lp"].total_cost
    curr = config.tariff.currency

    print(f"[Step 5] Grid-only Cost:       {c_grid:.2f} {curr}")
    print(f"[Step 5] Rule-based Cost:      {c_rule:.2f} {curr} (Saved: {c_grid - c_rule:.2f} {curr})")
    print(f"[Step 5] Optimised LP Cost:    {c_opt:.2f} {curr} (Saved: {c_grid - c_opt:.2f} {curr})")
    print(f"[Step 5] Hierarchy Validated:  {c_opt <= c_rule <= c_grid} [Optimised <= Rule <= Grid]")

    print("\n[Step 6] Running closed-loop sanity simulation...")
    sanity_slice = df.iloc[:48].copy()
    sim_df, sim_summary = run_simulation(
        sanity_slice,
        strategy="optimised_lp",
        config=config,
    )
    print(f"[Step 6] Simulated 48 hours | Grid-only: {sim_summary['grid_only_cost']:.2f} {curr} | Optimised: {sim_summary['total_cost']:.2f} {curr}")
    print(f"[Step 6] Savings: {sim_summary['savings_amount']:.2f} {curr} ({sim_summary['savings_percent']:.1f}%) | Self-Consumption: {sim_summary['solar_self_consumption_percent']:.1f}%")
    print(f"[Step 6] Forecast MAE: {sim_summary['forecast_mae']:.4f} kW | Faults Detected: {sim_summary['fault_hours_detected']}")

    print("\n" + "=" * 65)
    print("Ready. Start the API with: uvicorn api.main:app --port 8000")
    print("=" * 65)


if __name__ == "__main__":
    main()
