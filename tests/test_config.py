"""Unit tests for src/config.py."""

import pytest
from src.config import (
    BatteryConfig,
    DataConfig,
    FaultConfig,
    ForecastConfig,
    SolarConfig,
    SystemConfig,
    TariffConfig,
)


def test_solar_config_defaults() -> None:
    """Verify default values for SolarConfig."""
    cfg = SolarConfig()
    assert cfg.capacity_kwp == 10.0
    assert cfg.derate == 0.80
    assert cfg.temp_coeff == -0.004


def test_battery_config_defaults() -> None:
    """Verify default values for BatteryConfig."""
    cfg = BatteryConfig()
    assert cfg.capacity_kwh == 10.0
    assert cfg.max_power_kw == 5.0
    assert cfg.charge_eff == 0.95
    assert cfg.discharge_eff == 0.95
    assert cfg.min_soc == 0.10
    assert cfg.max_soc == 1.00
    assert cfg.initial_soc == 0.50


def test_tariff_config_defaults() -> None:
    """Verify default values for TariffConfig."""
    cfg = TariffConfig()
    assert cfg.off_peak_price == 6.0
    assert cfg.normal_price == 8.0
    assert cfg.peak_price == 11.0
    assert cfg.export_price == 3.0
    assert cfg.currency == "₹"


def test_tariff_time_of_use_hours() -> None:
    """Verify Time-of-Use pricing across off-peak, normal, and peak hours."""
    cfg = TariffConfig()

    # Off-peak hours: 22:00 to 06:00
    off_peak_hours = [22, 23, 0, 1, 2, 3, 4, 5]
    for h in off_peak_hours:
        assert cfg.get_import_price(h) == 6.0, f"Hour {h} should be off-peak (6.0)"

    # Normal hours: 06:00 to 18:00
    normal_hours = list(range(6, 18))
    for h in normal_hours:
        assert cfg.get_import_price(h) == 8.0, f"Hour {h} should be normal (8.0)"

    # Peak hours: 18:00 to 22:00
    peak_hours = [18, 19, 20, 21]
    for h in peak_hours:
        assert cfg.get_import_price(h) == 11.0, f"Hour {h} should be peak (11.0)"

    # Test invalid hour error
    with pytest.raises(ValueError):
        cfg.get_import_price(-1)
    with pytest.raises(ValueError):
        cfg.get_import_price(24)


def test_data_config_defaults() -> None:
    """Verify default values for DataConfig."""
    cfg = DataConfig()
    assert cfg.days == 365
    assert cfg.seed == 42
    assert cfg.train_fraction == 0.75


def test_fault_config_defaults() -> None:
    """Verify default values for FaultConfig."""
    cfg = FaultConfig()
    assert cfg.fault_fraction == 0.04
    assert cfg.residual_threshold_fraction == 0.30
    assert cfg.min_expected_kw_threshold == 1.0
    assert cfg.consecutive_hours_threshold == 2
    assert cfg.severity_medium_threshold == 0.30
    assert cfg.severity_high_threshold == 0.70


def test_forecast_config_defaults() -> None:
    """Verify default values for ForecastConfig."""
    cfg = ForecastConfig()
    assert cfg.n_estimators == 200
    assert cfg.max_depth == 14
    assert cfg.min_samples_leaf == 3
    assert cfg.n_jobs == -1
    assert cfg.random_state == 42
    assert cfg.sample_size_eval == 500


def test_system_config_aggregation() -> None:
    """Verify SystemConfig composes all subsystem configurations with defaults."""
    sys_cfg = SystemConfig()
    assert isinstance(sys_cfg.solar, SolarConfig)
    assert isinstance(sys_cfg.battery, BatteryConfig)
    assert isinstance(sys_cfg.tariff, TariffConfig)
    assert isinstance(sys_cfg.data, DataConfig)
    assert isinstance(sys_cfg.fault, FaultConfig)
    assert isinstance(sys_cfg.forecast, ForecastConfig)
    assert sys_cfg.solar.capacity_kwp == 10.0
    assert sys_cfg.battery.capacity_kwh == 10.0
    assert sys_cfg.tariff.currency == "₹"
    assert sys_cfg.data.seed == 42
    assert sys_cfg.fault.fault_fraction == 0.04
    assert sys_cfg.forecast.n_estimators == 200

