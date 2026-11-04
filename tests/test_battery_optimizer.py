"""Unit tests for battery management and optimisation module (src/battery_optimizer.py)."""

import numpy as np
import pytest

from src.config import BatteryConfig, SystemConfig
from src.battery_optimizer import (
    DispatchResult,
    run_all_strategies,
    strategy_grid_only,
    strategy_optimised_lp,
    strategy_rule_based,
    verify_energy_balance,
    verify_soc_bounds,
)


@pytest.fixture
def sample_day_inputs() -> tuple[np.ndarray, np.ndarray, np.ndarray, SystemConfig]:
    """Generate representative 24-hour solar, load, and tariff inputs."""
    config = SystemConfig()
    solar_kw = np.array(
        [
            0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5, 1.5, 3.2, 5.0, 6.5, 7.0,
            6.5, 5.0, 3.2, 1.5, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
        ],
        dtype=float,
    )
    load_kw = np.array(
        [
            1.2, 1.1, 1.0, 1.0, 1.1, 1.3, 2.0, 2.5, 2.0, 1.8, 1.7, 1.8,
            1.9, 2.0, 2.2, 2.5, 3.0, 3.5, 4.0, 3.8, 3.2, 2.5, 1.8, 1.4,
        ],
        dtype=float,
    )
    grid_price = np.array([config.tariff.get_import_price(h) for h in range(24)], dtype=float)
    return solar_kw, load_kw, grid_price, config


def test_energy_balance_all_strategies(sample_day_inputs: tuple) -> None:
    """Verify nodal energy balance holds within 1e-6 every hour across all strategies."""
    solar_kw, load_kw, grid_price, config = sample_day_inputs
    results = run_all_strategies(solar_kw, load_kw, grid_price, config)

    for name, res in results.items():
        is_balanced = verify_energy_balance(res, solar_kw, load_kw, tolerance=1e-6)
        assert is_balanced, f"Energy balance violated for strategy {name}"


def test_soc_never_leaves_bounds(sample_day_inputs: tuple) -> None:
    """Verify SoC remains strictly within [min_soc, max_soc] for all hours."""
    solar_kw, load_kw, grid_price, config = sample_day_inputs
    results = run_all_strategies(solar_kw, load_kw, grid_price, config)

    for name, res in results.items():
        soc_ok = verify_soc_bounds(res, config, tolerance=1e-6)
        assert soc_ok, f"SoC bounds violated for strategy {name}"


def test_cost_ordering_hierarchy(sample_day_inputs: tuple) -> None:
    """Verify the economic hierarchy: Optimised LP Cost <= Rule-based Cost <= Grid-only Cost."""
    solar_kw, load_kw, grid_price, config = sample_day_inputs
    results = run_all_strategies(solar_kw, load_kw, grid_price, config)

    cost_grid = results["grid_only"].total_cost
    cost_rule = results["rule_based"].total_cost
    cost_opt = results["optimised_lp"].total_cost

    # Allowance for tiny numerical precision epsilon (1e-4)
    assert cost_rule <= cost_grid + 1e-4, (
        f"Rule-based cost ({cost_rule:.2f}) should not exceed grid-only cost ({cost_grid:.2f})"
    )
    assert cost_opt <= cost_rule + 1e-4, (
        f"Optimised LP cost ({cost_opt:.2f}) should not exceed rule-based cost ({cost_rule:.2f})"
    )


def test_lp_terminal_soc_condition(sample_day_inputs: tuple) -> None:
    """Verify that the end-of-horizon SoC in LP is at least the initial SoC."""
    solar_kw, load_kw, grid_price, config = sample_day_inputs
    res_opt = strategy_optimised_lp(solar_kw, load_kw, grid_price, config)

    initial_soc = config.battery.initial_soc_kwh
    final_soc = res_opt.soc_kwh[-1]
    assert final_soc >= initial_soc - 1e-5, (
        f"Final SoC ({final_soc:.4f}) must be >= initial SoC ({initial_soc:.4f})"
    )


def test_no_simultaneous_charge_and_discharge(sample_day_inputs: tuple) -> None:
    """Verify that battery does not simultaneously charge and discharge."""
    solar_kw, load_kw, grid_price, config = sample_day_inputs
    results = run_all_strategies(solar_kw, load_kw, grid_price, config)

    for name, res in results.items():
        simultaneous = np.minimum(res.battery_charge_kw, res.battery_discharge_kw)
        max_simultaneous = np.max(simultaneous)
        assert max_simultaneous < 1e-4, (
            f"Strategy {name} exhibited material simultaneous charge+discharge: {max_simultaneous}"
        )


def test_edge_case_zero_solar(sample_day_inputs: tuple) -> None:
    """Edge case: 24 hours of zero solar generation (e.g. night / blackout simulation)."""
    _, load_kw, grid_price, config = sample_day_inputs
    zero_solar = np.zeros(24)

    results = run_all_strategies(zero_solar, load_kw, grid_price, config)
    for name, res in results.items():
        assert verify_energy_balance(res, zero_solar, load_kw)
        assert verify_soc_bounds(res, config)

    # Cost hierarchy must still hold
    assert results["optimised_lp"].total_cost <= results["rule_based"].total_cost + 1e-4
    assert results["rule_based"].total_cost <= results["grid_only"].total_cost + 1e-4


def test_edge_case_zero_load(sample_day_inputs: tuple) -> None:
    """Edge case: 24 hours of zero load consumption (building completely shut down)."""
    solar_kw, _, grid_price, config = sample_day_inputs
    zero_load = np.zeros(24)

    results = run_all_strategies(solar_kw, zero_load, grid_price, config)
    for name, res in results.items():
        assert verify_energy_balance(res, solar_kw, zero_load)
        assert verify_soc_bounds(res, config)


def test_edge_case_battery_initially_full(sample_day_inputs: tuple) -> None:
    """Edge case: Battery starts at maximum allowable SoC."""
    solar_kw, load_kw, grid_price, config = sample_day_inputs
    full_soc = config.battery.max_soc_kwh

    results = run_all_strategies(solar_kw, load_kw, grid_price, config, initial_soc_kwh=full_soc)
    for name, res in results.items():
        assert verify_energy_balance(res, solar_kw, load_kw)
        assert verify_soc_bounds(res, config)


def test_edge_case_battery_initially_empty(sample_day_inputs: tuple) -> None:
    """Edge case: Battery starts at minimum allowable SoC."""
    solar_kw, load_kw, grid_price, config = sample_day_inputs
    empty_soc = config.battery.min_soc_kwh

    results = run_all_strategies(solar_kw, load_kw, grid_price, config, initial_soc_kwh=empty_soc)
    for name, res in results.items():
        assert verify_energy_balance(res, solar_kw, load_kw)
        assert verify_soc_bounds(res, config)

    assert results["optimised_lp"].total_cost <= results["rule_based"].total_cost + 1e-4


def test_cost_ordering_hierarchy_30_days() -> None:
    """Step 12-B: Assert Optimised Cost <= Rule-based Cost + 1e-6 <= Grid-only Cost + 1e-6 on 35+ diverse days."""
    config = SystemConfig()
    csv_path = config.data_dir / "energy_data.csv"
    if not csv_path.exists():
        pytest.skip(f"Dataset {csv_path} not found")

    import pandas as pd
    df = pd.read_csv(csv_path)

    # Sample 36 distinct days across all seasons (every 10th day)
    sample_day_indices = list(range(0, 360, 10))
    assert len(sample_day_indices) >= 30, "Must test at least 30 distinct days"

    for day_idx in sample_day_indices:
        day_df = df.iloc[day_idx * 24 : (day_idx + 1) * 24].reset_index(drop=True)
        solar_kw = day_df["solar_kw_actual"].to_numpy().astype(float)
        load_kw = day_df["building_load_kw"].to_numpy().astype(float)
        hour_arr = day_df["hour"].to_numpy().astype(int)
        grid_price = np.array([config.tariff.get_import_price(h) for h in hour_arr], dtype=float)

        results = run_all_strategies(solar_kw, load_kw, grid_price, config)
        cost_grid = results["grid_only"].total_cost
        cost_rule = results["rule_based"].total_cost
        cost_opt = results["optimised_lp"].total_cost
        day_date = str(day_df["timestamp"].iloc[0])[:10]

        # 1. Rule-based cost <= Grid-only cost
        assert cost_rule <= cost_grid + 1e-6, (
            f"Day {day_date}: Rule-based cost ({cost_rule:.2f}) exceeded Grid-only cost ({cost_grid:.2f})"
        )
        # 2. Optimised LP cost <= Rule-based cost
        assert cost_opt <= cost_rule + 1e-6, (
            f"Day {day_date}: Optimised LP cost ({cost_opt:.2f}) exceeded Rule-based cost ({cost_rule:.2f})"
        )


def test_all_strategies_end_under_same_soc_rule() -> None:
    """Step 12-B: Assert all three strategies end the horizon under the same SoC rule (final SoC >= initial SoC)."""
    config = SystemConfig()
    csv_path = config.data_dir / "energy_data.csv"
    if not csv_path.exists():
        pytest.skip(f"Dataset {csv_path} not found")

    import pandas as pd
    df = pd.read_csv(csv_path)

    sample_day_indices = list(range(0, 360, 10))
    initial_soc = config.battery.initial_soc_kwh

    for day_idx in sample_day_indices:
        day_df = df.iloc[day_idx * 24 : (day_idx + 1) * 24].reset_index(drop=True)
        solar_kw = day_df["solar_kw_actual"].to_numpy().astype(float)
        load_kw = day_df["building_load_kw"].to_numpy().astype(float)
        hour_arr = day_df["hour"].to_numpy().astype(int)
        grid_price = np.array([config.tariff.get_import_price(h) for h in hour_arr], dtype=float)

        results = run_all_strategies(solar_kw, load_kw, grid_price, config)
        day_date = str(day_df["timestamp"].iloc[0])[:10]

        for name, res in results.items():
            final_soc = res.soc_kwh[-1]
            assert final_soc >= initial_soc - 1e-5, (
                f"Day {day_date}, strategy {name}: final SoC ({final_soc:.4f}) fell below initial SoC ({initial_soc:.4f})"
            )

