"""Central configuration module for the AI-Based Renewable Energy Management System.

All tunable parameters, system thresholds, physical ratings, tariffs, and random
seeds reside here to ensure reproducibility and prevent magic numbers throughout the codebase.
"""

from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class SolarConfig:
    """Parameters for the solar photovoltaic generation model.

    Attributes:
        capacity_kwp: Peak rated solar generation capacity in kWp (default: 10.0 kWp).
        derate: Total system derate factor accounting for inverter efficiency,
            wiring losses, and standard environmental losses (default: 0.80).
        temp_coeff: Temperature coefficient of maximum power in 1/°C (default: -0.004).
            Represents a 0.4% loss in power per °C above the reference cell temperature (25°C).
        ref_temp_c: Standard test condition (STC) cell reference temperature in °C (default: 25.0).
        temp_cell_coeff: Photovoltaic cell heating coefficient in °C/(W/m²) (default: 0.025).
            Formula: cell_temp = temperature_c + temp_cell_coeff * irradiance_wm2.
        noise_fraction: Gaussian standard deviation noise added to generation (default: 0.02).
    """

    capacity_kwp: float = 10.0
    derate: float = 0.80
    temp_coeff: float = -0.004
    ref_temp_c: float = 25.0
    temp_cell_coeff: float = 0.025
    noise_fraction: float = 0.02


@dataclass
class BatteryConfig:
    """Parameters for the battery energy storage system (BESS).

    Attributes:
        capacity_kwh: Nominal battery energy capacity in kWh (default: 10.0 kWh).
        max_power_kw: Maximum continuous charging and discharging power in kW (default: 5.0 kW).
        charge_eff: Round-trip charging efficiency factor (default: 0.95).
        discharge_eff: Discharging efficiency factor (default: 0.95).
        min_soc: Minimum state-of-charge allowable to preserve battery health (default: 0.10).
        max_soc: Maximum state-of-charge allowable to prevent overcharging (default: 1.00).
        initial_soc: Initial state-of-charge at the start of simulation (default: 0.50).
    """

    capacity_kwh: float = 10.0
    max_power_kw: float = 5.0
    charge_eff: float = 0.95
    discharge_eff: float = 0.95
    min_soc: float = 0.10
    max_soc: float = 1.00
    initial_soc: float = 0.50

    @property
    def min_soc_kwh(self) -> float:
        """Minimum allowable battery energy storage in kWh."""
        return self.min_soc * self.capacity_kwh

    @property
    def max_soc_kwh(self) -> float:
        """Maximum allowable battery energy storage in kWh."""
        return self.max_soc * self.capacity_kwh

    @property
    def initial_soc_kwh(self) -> float:
        """Initial stored battery energy at start of horizon in kWh."""
        return self.initial_soc * self.capacity_kwh


@dataclass
class TariffConfig:
    """Time-of-use (ToU) electricity tariffs and feed-in credits.

    Time windows:
        - Off-peak: 22:00 to 06:00 (default: ₹6.0/kWh)
        - Normal:   06:00 to 18:00 (default: ₹8.0/kWh)
        - Peak:     18:00 to 22:00 (default: ₹11.0/kWh)

    Attributes:
        off_peak_price: Grid import tariff during off-peak hours (default: 6.0).
        normal_price: Grid import tariff during normal daytime hours (default: 8.0).
        peak_price: Grid import tariff during peak evening hours (default: 11.0).
        export_price: Grid feed-in export tariff per kWh exported (default: 3.0).
        currency: Configurable currency symbol (default: '₹').
    """

    off_peak_price: float = 6.0
    normal_price: float = 8.0
    peak_price: float = 11.0
    export_price: float = 3.0
    currency: str = "₹"

    def get_import_price(self, hour: int) -> float:
        """Return the grid import price per kWh for a given hour of the day (0-23).

        Args:
            hour: Integer hour of the day in [0, 23].

        Returns:
            The import electricity tariff per kWh.
        """
        if not (0 <= hour <= 23):
            raise ValueError(f"Hour must be an integer between 0 and 23 inclusive, got {hour}")
        if 18 <= hour < 22:
            return self.peak_price
        elif 6 <= hour < 18:
            return self.normal_price
        else:
            return self.off_peak_price


@dataclass
class DataConfig:
    """Configuration for synthetic hourly dataset generation and data splitting.

    Attributes:
        days: Number of days to simulate (default: 365 days / 8,760 hours).
        seed: Master random seed for deterministic, reproducible generation (default: 42).
        train_fraction: Chronological split fraction for training (default: 0.75).
        start_date: Starting ISO timestamp for the time series (default: "2026-01-01 00:00:00").
        latitude_deg: Geographical latitude in degrees for solar position calculation (default: 20.0).
        cloud_persistence: Lag-1 autocorrelation parameter for cloud cover (default: 0.85).
        cloud_attenuation_factor: Factor scaling cloud cover impact on irradiance (default: 0.75).
        cloud_irradiance_exp: Non-linear exponent on cloud cover attenuation (default: 1.5).
        daytime_irradiance_threshold: Minimum irradiance (W/m²) considered daytime (default: 100.0).
        load_base_kw: Minimum baseline continuous electrical consumption in kW (default: 1.2).
        load_morning_bump_kw: Peak amplitude of morning load bump in kW (default: 1.2).
        load_evening_peak_kw: Peak amplitude of evening cooking/lighting demand in kW (default: 2.4).
        cooling_base_temp_c: Threshold ambient temperature above which AC load begins in °C (default: 26.0).
        cooling_load_coeff: AC cooling load factor in kW per °C above base temperature (default: 0.12).
    """

    days: int = 365
    seed: int = 42
    train_fraction: float = 0.75
    start_date: str = "2026-01-01 00:00:00"
    latitude_deg: float = 20.0
    cloud_persistence: float = 0.85
    cloud_attenuation_factor: float = 0.75
    cloud_irradiance_exp: float = 1.5
    daytime_irradiance_threshold: float = 100.0
    load_base_kw: float = 1.2
    load_morning_bump_kw: float = 1.2
    load_evening_peak_kw: float = 2.4
    cooling_base_temp_c: float = 26.0
    cooling_load_coeff: float = 0.12


@dataclass
class FaultConfig:
    """Configuration for PV fault injection and detection algorithms.

    Attributes:
        fault_fraction: Proportion of daytime generation hours injected with faults (default: 0.04).
        residual_threshold_fraction: Fraction of expected clear-sky power residual
            used as anomaly detection threshold (default: 0.30).
        min_block_hours: Minimum contiguous duration of a fault event in hours (default: 3).
        max_block_hours: Maximum contiguous duration of a fault event in hours (default: 8).
        shading_factor_min: Minimum derate factor under partial shading (default: 0.40).
        shading_factor_max: Maximum derate factor under partial shading (default: 0.70).
        inverter_fail_factor_max: Maximum output factor during inverter failure (default: 0.02).
        soiling_factor_min: Minimum derate factor under panel soiling (default: 0.75).
        soiling_factor_max: Maximum derate factor under panel soiling (default: 0.90).
    """

    fault_fraction: float = 0.04
    residual_threshold_fraction: float = 0.30
    min_block_hours: int = 3
    max_block_hours: int = 8
    shading_factor_min: float = 0.40
    shading_factor_max: float = 0.70
    inverter_fail_factor_max: float = 0.02
    soiling_factor_min: float = 0.75
    soiling_factor_max: float = 0.90
    min_expected_kw_threshold: float = 1.0
    consecutive_hours_threshold: int = 2
    severity_medium_threshold: float = 0.30
    severity_high_threshold: float = 0.70


@dataclass
class ForecastConfig:
    """Hyperparameters and settings for solar forecasting regression models.

    Attributes:
        n_estimators: Number of trees in the random forest ensemble (default: 200).
        max_depth: Maximum depth of each decision tree (default: 14).
        min_samples_leaf: Minimum number of samples required at a leaf node (default: 3).
        n_jobs: Number of parallel jobs for fitting and prediction (-1 for all cores, default: -1).
        random_state: Random seed for deterministic model training (default: 42).
        sample_size_eval: Maximum sample size of test points saved for UI scatter plots (default: 500).
    """

    n_estimators: int = 200
    max_depth: int = 14
    min_samples_leaf: int = 3
    n_jobs: int = -1
    random_state: int = 42
    sample_size_eval: int = 500


@dataclass
class SystemConfig:
    """Aggregated system configuration combining all subsystem configurations."""

    solar: SolarConfig = field(default_factory=SolarConfig)
    battery: BatteryConfig = field(default_factory=BatteryConfig)
    tariff: TariffConfig = field(default_factory=TariffConfig)
    data: DataConfig = field(default_factory=DataConfig)
    fault: FaultConfig = field(default_factory=FaultConfig)
    forecast: ForecastConfig = field(default_factory=ForecastConfig)

    # Base filesystem paths
    base_dir: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent)
    data_dir: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent / "data")
    models_dir: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent / "models")
