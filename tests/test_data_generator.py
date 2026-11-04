"""Unit tests for synthetic dataset generation (src/data_generator.py)."""

import numpy as np
import pandas as pd
import pytest

from src.config import DataConfig, FaultConfig, SolarConfig, SystemConfig
from src.data_generator import generate_dataset


@pytest.fixture
def default_df() -> pd.DataFrame:
    """Generate default 365-day dataset for testing."""
    config = SystemConfig()
    return generate_dataset(config)


def test_required_columns_and_length(default_df: pd.DataFrame) -> None:
    """Verify all required columns exist with the expected row count (365 * 24 = 8760)."""
    expected_cols = [
        "timestamp",
        "hour",
        "day_of_year",
        "month",
        "temperature_c",
        "irradiance_wm2",
        "cloud_cover",
        "solar_kw_actual",
        "building_load_kw",
        "is_fault",
    ]
    assert list(default_df.columns) == expected_cols
    assert len(default_df) == 365 * 24


def test_no_negative_values(default_df: pd.DataFrame) -> None:
    """Verify that no physical variables contain negative values."""
    numerical_cols = [
        "temperature_c",
        "irradiance_wm2",
        "cloud_cover",
        "solar_kw_actual",
        "building_load_kw",
    ]
    for col in numerical_cols:
        min_val = default_df[col].min()
        assert min_val >= 0.0, f"Column {col} has negative values (min: {min_val})"


def test_solar_zero_at_night(default_df: pd.DataFrame) -> None:
    """Verify solar generation is strictly 0.0 whenever irradiance is 0."""
    night_rows = default_df[default_df["irradiance_wm2"] == 0.0]
    assert len(night_rows) > 0, "Expected night hours with 0 irradiance"
    max_solar_night = night_rows["solar_kw_actual"].max()
    assert max_solar_night == 0.0, f"Solar generation at night must be 0.0, got {max_solar_night}"


def test_solar_never_exceeds_capacity(default_df: pd.DataFrame) -> None:
    """Verify solar generation never exceeds the rated peak capacity (10 kWp)."""
    config = SolarConfig()
    max_solar = default_df["solar_kw_actual"].max()
    assert (
        max_solar <= config.capacity_kwp
    ), f"Solar output {max_solar} exceeded rated capacity {config.capacity_kwp}"


def test_fault_fraction_within_tolerance(default_df: pd.DataFrame) -> None:
    """Verify injected daytime faults match the configured fault fraction within tolerance."""
    config = SystemConfig()
    daytime_df = default_df[default_df["irradiance_wm2"] > config.data.daytime_irradiance_threshold]
    total_daytime = len(daytime_df)
    faulty_daytime = daytime_df["is_fault"].sum()

    actual_fault_fraction = faulty_daytime / total_daytime
    target_fault_fraction = config.fault.fault_fraction

    # Tolerance within +/- 0.005 (0.5 percentage points)
    assert abs(actual_fault_fraction - target_fault_fraction) < 0.005, (
        f"Daytime fault fraction {actual_fault_fraction:.4f} differs from target "
        f"{target_fault_fraction:.4f} by more than 0.005"
    )


def test_contiguous_fault_blocks(default_df: pd.DataFrame) -> None:
    """Verify faults occur in contiguous blocks of 3 to 8 hours."""
    config = FaultConfig()
    is_fault = default_df["is_fault"].to_numpy()

    # Find contiguous fault segments
    fault_blocks: list[int] = []
    current_run = 0
    for val in is_fault:
        if val == 1:
            current_run += 1
        elif current_run > 0:
            fault_blocks.append(current_run)
            current_run = 0
    if current_run > 0:
        fault_blocks.append(current_run)

    assert len(fault_blocks) > 0, "Expected fault blocks to be injected"
    for length in fault_blocks:
        assert config.min_block_hours <= length <= config.max_block_hours, (
            f"Fault block length {length} is outside allowed range "
            f"[{config.min_block_hours}, {config.max_block_hours}]"
        )


def test_reproducibility_same_seed() -> None:
    """Verify that identical random seed produces bitwise identical datasets."""
    config1 = SystemConfig(data=DataConfig(days=30, seed=42))
    config2 = SystemConfig(data=DataConfig(days=30, seed=42))

    df1 = generate_dataset(config1)
    df2 = generate_dataset(config2)

    pd.testing.assert_frame_equal(df1, df2)


def test_different_seeds_produce_different_data() -> None:
    """Verify that changing the seed produces different time series."""
    config1 = SystemConfig(data=DataConfig(days=30, seed=42))
    config2 = SystemConfig(data=DataConfig(days=30, seed=99))

    df1 = generate_dataset(config1)
    df2 = generate_dataset(config2)

    assert not df1["cloud_cover"].equals(df2["cloud_cover"])

