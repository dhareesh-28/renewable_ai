"""Realistic synthetic hourly dataset generator for microgrid simulation.

Generates an hourly time series of solar irradiance, autocorrelated cloud cover,
ambient temperature, PV generation under thermal derating and faults, and building
consumption profiles.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path
from typing import Optional

# Ensure project root is in sys.path when executed directly
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

# Ensure UTF-8 output encoding on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
import pandas as pd

from src.config import SystemConfig


def _calculate_clear_sky_irradiance(
    days: int,
    latitude_deg: float,
) -> np.ndarray:
    """Calculate hourly clear-sky solar irradiance (W/m²) over the simulation duration.

    Uses standard astronomical solar geometry: solar declination, hour angle,
    and solar altitude. Returns 0.0 during nighttime.

    Args:
        days: Total simulation duration in days.
        latitude_deg: Geographical latitude in degrees (positive North).

    Returns:
        1D numpy array of clear-sky irradiance values of length days * 24.
    """
    total_hours = days * 24
    hour_of_day = np.tile(np.arange(24), days)
    day_of_year = np.repeat(np.arange(1, days + 1), 24)

    # Solar declination angle in radians (Cooper's equation)
    # delta = 23.45 * sin(2*pi * (284 + day) / 365)
    declination_rad = np.radians(
        23.45 * np.sin(2.0 * np.pi * (284.0 + day_of_year) / 365.0)
    )

    # Solar hour angle omega: 0 at solar noon (12:00), 15 degrees per hour
    # omega = 15 * (hour - 12) degrees
    hour_angle_rad = np.radians(15.0 * (hour_of_day - 12.0))

    lat_rad = math.radians(latitude_deg)

    # Solar elevation angle alpha (sin(alpha) = sin(phi)*sin(delta) + cos(phi)*cos(delta)*cos(omega))
    sin_alpha = np.sin(lat_rad) * np.sin(declination_rad) + np.cos(lat_rad) * np.cos(
        declination_rad
    ) * np.cos(hour_angle_rad)

    # Extraterrestrial solar constant with earth orbital eccentricity
    # I0 ~ 1361 W/m^2, clear-sky surface peak ~1000 W/m^2 at zenith
    eccentricity = 1.0 + 0.033 * np.cos(2.0 * np.pi * day_of_year / 365.0)
    peak_surface_irradiance = 1000.0 * eccentricity

    # Clear-sky irradiance curve; strictly 0 when sun is below horizon
    clear_sky = np.where(
        sin_alpha > 0.0,
        peak_surface_irradiance * np.maximum(0.0, sin_alpha) ** 1.15,
        0.0,
    )

    return np.maximum(0.0, clear_sky)


def _generate_cloud_cover(
    days: int,
    persistence: float,
    rng: np.random.Generator,
) -> np.ndarray:
    """Generate an autocorrelated cloud cover time series in [0, 1].

    Combines multi-day weather pattern persistence (clear spells vs. overcast spells)
    with hourly AR(1) autocorrelation so cloud cover evolves continuously.

    Args:
        days: Total simulation duration in days.
        persistence: Lag-1 autocorrelation coefficient (rho).
        rng: Initialized NumPy random generator for reproducibility.

    Returns:
        1D numpy array of cloud cover values in [0.0, 1.0] of length days * 24.
    """
    total_hours = days * 24

    # 1. Daily weather regime latent process (AR(1) at daily scale)
    daily_regime = np.zeros(days)
    daily_phi = 0.65
    regime_val = rng.normal(0.0, 1.0)
    for d in range(days):
        regime_val = daily_phi * regime_val + np.sqrt(1.0 - daily_phi**2) * rng.normal(0.0, 1.0)
        daily_regime[d] = regime_val

    # Map daily regime into target daily cloud mean [0.05, 0.90]
    # Positive z -> cloudy/overcast; Negative z -> clear sky
    daily_mean = 0.40 + 0.35 * np.tanh(daily_regime)

    # 2. Hourly AR(1) process centered around daily regime mean
    cloud_cover = np.zeros(total_hours)
    current_cloud = daily_mean[0]
    hourly_noise_std = 0.08

    for h in range(total_hours):
        day_idx = h // 24
        target_mean = daily_mean[day_idx]
        shock = rng.normal(0.0, hourly_noise_std)
        current_cloud = persistence * current_cloud + (1.0 - persistence) * target_mean + shock
        cloud_cover[h] = np.clip(current_cloud, 0.0, 1.0)

    return cloud_cover


def _generate_temperature(
    days: int,
    cloud_cover: np.ndarray,
    clear_sky: np.ndarray,
    rng: np.random.Generator,
) -> np.ndarray:
    """Generate hourly ambient temperature with seasonal, diurnal, and cloud-cooling effects.

    Args:
        days: Total simulation duration in days.
        cloud_cover: Hourly cloud cover array.
        clear_sky: Hourly clear-sky irradiance array.
        rng: Initialized NumPy random generator.

    Returns:
        1D numpy array of ambient temperature in °C (roughly 18 to 40 °C).
    """
    total_hours = days * 24
    hour_of_day = np.tile(np.arange(24), days)
    day_of_year = np.repeat(np.arange(1, days + 1), 24)

    # Annual seasonal sinusoid: cooler in winter (Dec/Jan), hottest in May/June
    # Peak summer near day 145 (mid-May)
    seasonal_temp = 28.5 - 6.5 * np.cos(2.0 * np.pi * (day_of_year - 15.0) / 365.0)

    # Diurnal cycle: minimum around 05:00, maximum around 14:00 (phase shift = 9 hours)
    diurnal_temp = 5.2 * np.sin(2.0 * np.pi * (hour_of_day - 9.0) / 24.0)

    # Cloud attenuation effect: heavy cloud cover dampens daytime peak solar heating
    daytime_mask = clear_sky > 50.0
    cloud_cooling = np.zeros(total_hours)
    cloud_cooling[daytime_mask] = -2.5 * cloud_cover[daytime_mask]

    # Correlated weather temperature noise (AR(1) with 0.90 lag)
    noise = np.zeros(total_hours)
    noise_val = 0.0
    for t in range(total_hours):
        noise_val = 0.90 * noise_val + np.sqrt(1.0 - 0.90**2) * rng.normal(0.0, 0.70)
        noise[t] = noise_val

    raw_temp = seasonal_temp + diurnal_temp + cloud_cooling + noise
    return np.clip(raw_temp, 18.0, 40.0)


def _generate_building_load(
    days: int,
    temperature_c: np.ndarray,
    rng: np.random.Generator,
    config: SystemConfig,
) -> np.ndarray:
    """Generate realistic hourly building load consumption profile.

    Features morning breakfast bump, major evening domestic peak, weekday/weekend
    behavioral shifts, temperature-dependent cooling load, and random noise.
    Expected range: roughly 1 to 6 kW.

    Args:
        days: Total simulation duration in days.
        temperature_c: Hourly ambient temperature in °C.
        rng: Initialized NumPy random generator.
        config: SystemConfig instance containing baseline load parameters.

    Returns:
        1D numpy array of building load in kW.
    """
    total_hours = days * 24
    hour_of_day = np.tile(np.arange(24), days)
    # Day of week: assume day 0 is Thursday (2026-01-01 is a Thursday)
    day_indices = np.repeat(np.arange(days), 24)
    # 0 = Thursday, 1 = Friday, 2 = Saturday, 3 = Sunday, 4 = Monday, 5 = Tuesday, 6 = Wednesday
    day_of_week = (day_indices + 3) % 7
    is_weekend = (day_of_week == 5) | (day_of_week == 6)

    # Baseload
    load = np.full(total_hours, config.data.load_base_kw)

    # Morning bump: weekdays 08:30 (std 1.4), weekends 10:00 (std 1.8)
    morning_center = np.where(is_weekend, 10.0, 8.5)
    morning_width = np.where(is_weekend, 1.8, 1.4)
    morning_bump = config.data.load_morning_bump_kw * np.exp(
        -0.5 * ((hour_of_day - morning_center) / morning_width) ** 2
    )

    # Evening peak: 19:30 to 20:30 (cooking, lighting, appliances)
    evening_center = 20.0
    evening_width = np.where(is_weekend, 2.2, 1.8)
    evening_peak = config.data.load_evening_peak_kw * np.exp(
        -0.5 * ((hour_of_day - evening_center) / evening_width) ** 2
    )

    # Weekend daytime occupancy bump (11:00 to 17:00)
    weekend_afternoon = np.where(
        is_weekend & (hour_of_day >= 11) & (hour_of_day <= 17),
        0.45,
        0.0,
    )

    # Temperature-dependent air conditioning cooling load
    cooling_delta = np.maximum(0.0, temperature_c - config.data.cooling_base_temp_c)
    cooling_load = config.data.cooling_load_coeff * cooling_delta

    # Random consumption fluctuations
    load_noise = rng.normal(0.0, 0.12, total_hours)

    total_load = load + morning_bump + evening_peak + weekend_afternoon + cooling_load + load_noise
    return np.clip(total_load, 1.0, 6.0)


def _inject_faults(
    irradiance_wm2: np.ndarray,
    solar_kw_clean: np.ndarray,
    rng: np.random.Generator,
    config: SystemConfig,
) -> tuple[np.ndarray, np.ndarray]:
    """Inject realistic PV faults into contiguous blocks of daytime hours.

    Fault types:
    - Partial shading: derates output by factor in [0.4, 0.7]
    - Inverter failure: derates output near 0 (< 0.02)
    - Soiling / degradation: derates output by factor in [0.75, 0.90]

    Args:
        irradiance_wm2: Hourly irradiance array in W/m².
        solar_kw_clean: Clean baseline solar generation in kW.
        rng: Initialized NumPy random generator.
        config: SystemConfig instance containing fault settings.

    Returns:
        Tuple of (solar_kw_actual, is_fault_array).
    """
    total_hours = len(irradiance_wm2)
    solar_kw_actual = solar_kw_clean.copy()
    is_fault = np.zeros(total_hours, dtype=int)

    daytime_threshold = config.data.daytime_irradiance_threshold
    is_daytime = irradiance_wm2 > daytime_threshold
    daytime_indices = np.where(is_daytime)[0]
    total_daytime_hours = len(daytime_indices)

    target_faulty_hours = int(round(config.fault.fault_fraction * total_daytime_hours))

    # Group daytime indices by day to ensure contiguous blocks occur within the same day
    days_count = total_hours // 24
    day_daytime_blocks: list[np.ndarray] = []
    for d in range(days_count):
        d_start = d * 24
        d_end = d_start + 24
        d_daytime = [idx for idx in range(d_start, d_end) if is_daytime[idx]]
        if len(d_daytime) >= config.fault.min_block_hours:
            day_daytime_blocks.append(np.array(d_daytime))

    # Shuffle day blocks deterministically to scatter faults realistically across the year
    block_order = rng.permutation(len(day_daytime_blocks))
    accumulated_fault_hours = 0

    fault_types = ["shading", "inverter_failure", "soiling"]

    for b_idx in block_order:
        if accumulated_fault_hours >= target_faulty_hours:
            break

        cand_indices = day_daytime_blocks[b_idx]
        max_possible_len = min(config.fault.max_block_hours, len(cand_indices))
        if max_possible_len < config.fault.min_block_hours:
            continue

        # Choose block length between min_block_hours and max_possible_len
        remaining = target_faulty_hours - accumulated_fault_hours
        upper_len = min(max_possible_len, max(config.fault.min_block_hours, remaining))
        if upper_len < config.fault.min_block_hours:
            block_len = config.fault.min_block_hours
        else:
            block_len = rng.integers(config.fault.min_block_hours, upper_len + 1)

        # Pick contiguous slice inside this day's daytime hours
        max_start = len(cand_indices) - block_len
        start_pos = rng.integers(0, max_start + 1)
        target_slice = cand_indices[start_pos : start_pos + block_len]

        # Select fault type
        f_type = rng.choice(fault_types)
        if f_type == "shading":
            scale_factor = rng.uniform(
                config.fault.shading_factor_min, config.fault.shading_factor_max
            )
        elif f_type == "inverter_failure":
            scale_factor = rng.uniform(0.0, config.fault.inverter_fail_factor_max)
        else:  # soiling
            scale_factor = rng.uniform(
                config.fault.soiling_factor_min, config.fault.soiling_factor_max
            )

        # Apply fault
        solar_kw_actual[target_slice] = solar_kw_clean[target_slice] * scale_factor
        is_fault[target_slice] = 1
        accumulated_fault_hours += len(target_slice)

    return solar_kw_actual, is_fault


def generate_dataset(config: Optional[SystemConfig] = None) -> pd.DataFrame:
    """Generate the synthetic hourly energy dataset for the simulated microgrid.

    Columns generated:
        - timestamp: Hourly timestamp string (YYYY-MM-DD HH:MM:SS)
        - hour: Hour of day in [0, 23]
        - day_of_year: Day of the year in [1, days]
        - month: Month of year in [1, 12]
        - temperature_c: Ambient dry-bulb temperature in °C
        - irradiance_wm2: Global horizontal irradiance in W/m²
        - cloud_cover: Autocorrelated cloud fraction in [0, 1]
        - solar_kw_actual: Actual solar generation in kW (including thermal losses, noise, faults)
        - building_load_kw: Building electrical consumption in kW
        - is_fault: Binary fault indicator (1 if PV anomaly injected, 0 otherwise)

    Args:
        config: SystemConfig instance. If None, default SystemConfig is used.

    Returns:
        pd.DataFrame containing the complete hourly simulation time series.
    """
    if config is None:
        config = SystemConfig()

    rng = np.random.default_rng(config.data.seed)
    days = config.data.days
    total_hours = days * 24

    # 1. Timestamps and calendar features
    timestamps = pd.date_range(
        start=config.data.start_date,
        periods=total_hours,
        freq="h",
    )
    hour = timestamps.hour.to_numpy()
    day_of_year = timestamps.day_of_year.to_numpy()
    month = timestamps.month.to_numpy()

    # 2. Physics-based Clear-Sky Irradiance
    clear_sky = _calculate_clear_sky_irradiance(
        days=days,
        latitude_deg=config.data.latitude_deg,
    )

    # 3. Autocorrelated Cloud Cover
    cloud_cover = _generate_cloud_cover(
        days=days,
        persistence=config.data.cloud_persistence,
        rng=rng,
    )

    # 4. Actual Irradiance: attenuated by cloud cover, zero at night
    attenuation = 1.0 - config.data.cloud_attenuation_factor * (
        cloud_cover**config.data.cloud_irradiance_exp
    )
    irradiance_wm2 = np.where(clear_sky > 0.0, clear_sky * np.maximum(0.0, attenuation), 0.0)
    irradiance_wm2 = np.maximum(0.0, irradiance_wm2)

    # 5. Ambient Temperature
    temperature_c = _generate_temperature(
        days=days,
        cloud_cover=cloud_cover,
        clear_sky=clear_sky,
        rng=rng,
    )

    # 6. Clean Solar Generation (with cell temperature derating & Gaussian noise)
    # cell_temp = temperature_c + temp_cell_coeff * irradiance_wm2
    cell_temp = temperature_c + config.solar.temp_cell_coeff * irradiance_wm2
    thermal_derate = 1.0 + config.solar.temp_coeff * (cell_temp - config.solar.ref_temp_c)

    clean_solar_kw = (
        config.solar.capacity_kwp
        * (irradiance_wm2 / 1000.0)
        * config.solar.derate
        * thermal_derate
    )
    # Add 2% Gaussian noise to solar generation
    noise = rng.normal(0.0, config.solar.noise_fraction, total_hours)
    clean_solar_kw = clean_solar_kw * (1.0 + noise)

    # Strict physical bounds: 0 at night, never negative, never exceeds peak capacity
    clean_solar_kw = np.where(irradiance_wm2 <= 0.0, 0.0, clean_solar_kw)
    clean_solar_kw = np.clip(clean_solar_kw, 0.0, config.solar.capacity_kwp)

    # 7. Fault Injections into Daytime Hours
    solar_kw_actual, is_fault = _inject_faults(
        irradiance_wm2=irradiance_wm2,
        solar_kw_clean=clean_solar_kw,
        rng=rng,
        config=config,
    )

    # 8. Building Load Consumption
    building_load_kw = _generate_building_load(
        days=days,
        temperature_c=temperature_c,
        rng=rng,
        config=config,
    )

    # Assemble DataFrame with strict types
    df = pd.DataFrame(
        {
            "timestamp": timestamps.strftime("%Y-%m-%d %H:%M:%S"),
            "hour": hour.astype(int),
            "day_of_year": day_of_year.astype(int),
            "month": month.astype(int),
            "temperature_c": np.round(temperature_c, 2),
            "irradiance_wm2": np.round(irradiance_wm2, 2),
            "cloud_cover": np.round(cloud_cover, 4),
            "solar_kw_actual": np.round(solar_kw_actual, 3),
            "building_load_kw": np.round(building_load_kw, 3),
            "is_fault": is_fault.astype(int),
        }
    )

    return df


def print_sanity_check_week(df: pd.DataFrame, start_day: int = 75) -> None:
    """Print one representative week of hourly data as a clean text table.

    Args:
        df: Generated energy DataFrame.
        start_day: Day of year to start the 7-day display (default: day 75, mid-March).
    """
    start_hour = (start_day - 1) * 24
    end_hour = start_hour + 7 * 24
    sample_df = df.iloc[start_hour:end_hour]

    print("\n" + "=" * 105)
    print(f"SANITY CHECK: REPRESENTATIVE 7-DAY HOURLY PROFILE (Days {start_day} to {start_day + 6})")
    print("=" * 105)
    print(
        f"{'Timestamp':<20} | {'Hour':<4} | {'Temp (°C)':<9} | {'Irrad (W/m²)':<12} | "
        f"{'Cloud':<6} | {'Solar (kW)':<10} | {'Load (kW)':<9} | {'Fault':<5}"
    )
    print("-" * 105)

    # Print midday hours (10:00 to 14:00) and night hours (00:00, 22:00) for each day
    display_hours = {0, 6, 9, 12, 15, 18, 21}
    for _, row in sample_df.iterrows():
        if row["hour"] in display_hours:
            fault_flag = "YES (!)" if row["is_fault"] == 1 else "NO"
            print(
                f"{row['timestamp']:<20} | {int(row['hour']):<4} | {row['temperature_c']:<9.2f} | "
                f"{row['irradiance_wm2']:<12.2f} | {row['cloud_cover']:<6.3f} | "
                f"{row['solar_kw_actual']:<10.3f} | {row['building_load_kw']:<9.3f} | {fault_flag:<5}"
            )


def main() -> None:
    """Script entrypoint: generate dataset, save CSV, and print diagnostics."""
    config = SystemConfig()
    print("Generating realistic synthetic dataset...")
    df = generate_dataset(config)

    # Ensure output directory exists
    config.data_dir.mkdir(parents=True, exist_ok=True)
    csv_path = config.data_dir / "energy_data.csv"
    df.to_csv(csv_path, index=False)
    print(f"Dataset saved to: {csv_path} ({len(df)} rows)")

    # Diagnostics
    print("\n" + "=" * 60)
    print("DATASET SUMMARY STATISTICS (df.describe()):")
    print("=" * 60)
    print(df.describe().to_string())

    daytime_df = df[df["irradiance_wm2"] > config.data.daytime_irradiance_threshold]
    total_daytime = len(daytime_df)
    faulty_daytime = int(daytime_df["is_fault"].sum())
    fault_pct_daytime = (faulty_daytime / total_daytime) * 100.0
    fault_pct_overall = (df["is_fault"].sum() / len(df)) * 100.0

    print("\n" + "=" * 60)
    print("FAULT INJECTION METRICS:")
    print("=" * 60)
    print(f"Total Hours:                {len(df)}")
    print(f"Total Daytime Hours (>100): {total_daytime}")
    print(f"Faulty Daytime Hours:       {faulty_daytime}")
    print(f"Target Daytime Fault %:     {config.fault.fault_fraction * 100.0:.2f}%")
    print(f"Actual Daytime Fault %:     {fault_pct_daytime:.2f}%")
    print(f"Overall Dataset Fault %:    {fault_pct_overall:.2f}%")

    # Print one representative clear week
    print_sanity_check_week(df, start_day=75)


if __name__ == "__main__":
    main()
