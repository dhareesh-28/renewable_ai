"""Pydantic v2 schemas for the Renewable Energy Management System REST API."""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """System health check and state verification schema."""

    status: str = Field(description="Operational health status, e.g. 'healthy'")
    service: str = Field(description="Service identifier name")
    min_timestamp: str = Field(description="Earliest available hourly timestamp in dataset")
    max_timestamp: str = Field(description="Latest available hourly timestamp in dataset")
    total_rows: int = Field(description="Total hourly observations loaded in memory")
    forecast_model_loaded: bool = Field(description="Flag confirming Random Forest model availability")
    iso_model_loaded: bool = Field(description="Flag confirming Isolation Forest model availability")


class MetaResponse(BaseModel):
    """Metadata detailing dataset duration, default physical ratings, and tariffs."""

    min_timestamp: str
    max_timestamp: str
    total_days: int
    currency: str
    strategies: list[str]
    solar_defaults: dict[str, Any]
    battery_defaults: dict[str, Any]
    tariff_defaults: dict[str, Any]


class HourlyTelemetryPoint(BaseModel):
    """Detailed microgrid operational state at a single hour."""

    timestamp: str
    solar_predicted_kw: float
    solar_actual_kw: float
    load_kw: float
    battery_charge_kw: float
    battery_discharge_kw: float
    soc_pct: float
    grid_import_kw: float
    grid_export_kw: float
    price: float
    fault_flag: int
    fault_severity: str


class SimulationSummaryKPIs(BaseModel):
    """Aggregated financial and energy key performance indicators."""

    strategy: str
    strategy_name: str
    total_cost: float
    grid_only_cost: float
    savings_amount: float
    savings_percent: float
    grid_import_kwh: float
    grid_export_kwh: float
    solar_generation_kwh: float
    building_load_kwh: float
    solar_self_consumption_percent: float
    battery_cycles: float
    fault_hours_detected: int
    forecast_mae: float
    currency: str


class SimulateResponse(BaseModel):
    """Response payload for closed-loop horizon simulation."""

    horizon_start: str
    horizon_end: str
    hours: int
    strategy: str
    hourly_series: list[HourlyTelemetryPoint]
    summary: SimulationSummaryKPIs
    baseline: SimulationSummaryKPIs


class CumulativeCostPoint(BaseModel):
    """Cumulative financial expenditure comparison at an hour."""

    timestamp: str
    grid_only: float
    rule_based: float
    optimised_lp: float


class CompareResponse(BaseModel):
    """Comparative evaluation across all three dispatch strategies."""

    horizon_start: str
    horizon_end: str
    hours: int
    currency: str
    strategies: dict[str, SimulationSummaryKPIs]
    cumulative_cost_series: list[CumulativeCostPoint]


class OutlookSchedulePoint(BaseModel):
    """Hourly forecast and recommended dispatch schedule for next 24 hours."""

    timestamp: str
    hour: int
    solar_predicted_kw: float
    building_load_kw: float
    battery_charge_kw: float
    battery_discharge_kw: float
    soc_pct: float
    grid_import_kw: float
    grid_export_kw: float
    grid_price: float


class OutlookResponse(BaseModel):
    """Next-24h predictive outlook and battery dispatch schedule."""

    start_timestamp: str
    end_timestamp: str
    hours: int
    expected_cost: float
    currency: str
    hourly_outlook: list[OutlookSchedulePoint]


class FaultEventItem(BaseModel):
    """Discrete photovoltaic fault anomaly event."""

    start: str
    end: str
    duration_h: int
    severity: str
    energy_lost_kwh: float
    cost_lost: float
    detected_by: str


class FaultsResponse(BaseModel):
    """Collection of detected PV fault events over a time horizon."""

    total_events: int
    total_energy_lost_kwh: float
    total_cost_lost: float
    currency: str
    events: list[FaultEventItem]


class PeriodItem(BaseModel):
    """Aggregated performance metrics for a specific calendar period (e.g. month)."""

    period: str
    solar_kwh: float
    load_kwh: float
    grid_only_cost: float
    rule_based_cost: float
    optimised_cost: float
    savings_amount: float
    savings_percent: float
    solar_self_consumption_percent: float
    battery_cycles: float
    fault_hours: int


class PeriodSummaryResponse(BaseModel):
    """Periodic energy and cost breakdown over a year."""

    year: int
    granularity: str
    currency: str
    periods: list[PeriodItem]


class ModelPerformanceResponse(BaseModel):
    """Comprehensive offline validation benchmarks for forecasting and fault detection."""

    forecast_metrics: dict[str, Any]
    fault_metrics: dict[str, Any]

