"""FastAPI application for the AI-Based Renewable Energy Management System.

Serves endpoints for microgrid simulation, comparative dispatch evaluation,
predictive outlooks, fault diagnostics, periodic accounting, and model benchmarks.
"""

from __future__ import annotations

import json
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

# Ensure project root is in sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

# Ensure UTF-8 output encoding on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from api.schemas import (
    CompareResponse,
    CumulativeCostPoint,
    FaultEventItem,
    FaultsResponse,
    HealthResponse,
    HourlyTelemetryPoint,
    MetaResponse,
    ModelPerformanceResponse,
    OutlookResponse,
    OutlookSchedulePoint,
    PeriodItem,
    PeriodSummaryResponse,
    SimulateResponse,
    SimulationSummaryKPIs,
)
from src.battery_optimizer import strategy_grid_only, strategy_optimised_lp, strategy_rule_based
from src.config import BatteryConfig, SystemConfig
from src.fault_detection import detect_faults, extract_fault_events
from src.forecasting import load_model, predict
from src.simulation import get_24h_forecast, run_all_strategies, run_period, run_simulation


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load dataset, configuration, and trained models once during server startup."""
    config = SystemConfig()
    app.state.config = config

    # 1. Verify Dataset
    data_path = config.data_dir / "energy_data.csv"
    if not data_path.exists():
        raise RuntimeError(
            f"Required dataset missing at '{data_path}'. Please run 'python run_all.py' first."
        )
    df = pd.read_csv(data_path)
    app.state.df = df
    app.state.min_timestamp = str(df.iloc[0]["timestamp"])
    app.state.max_timestamp = str(df.iloc[-1]["timestamp"])

    # 2. Verify Models
    model_rf_path = config.models_dir / "solar_rf.joblib"
    model_iso_path = config.models_dir / "isolation_forest.joblib"
    metrics_fc_path = config.models_dir / "forecast_metrics.json"
    metrics_flt_path = config.models_dir / "fault_metrics.json"

    if not model_rf_path.exists():
        raise RuntimeError(
            f"Forecast model missing at '{model_rf_path}'. Please run 'python run_all.py' first."
        )
    if not model_iso_path.exists():
        raise RuntimeError(
            f"Fault model missing at '{model_iso_path}'. Please run 'python run_all.py' first."
        )
    if not metrics_fc_path.exists() or not metrics_flt_path.exists():
        raise RuntimeError(
            "Evaluation metrics missing in models/ directory. Please run 'python run_all.py' first."
        )

    app.state.forecast_model = joblib.load(model_rf_path)
    app.state.iso_model = joblib.load(model_iso_path)

    # Pre-warm monthly period summary cache during startup
    app.state.period_summary_cache = {}
    period_df = run_period(
        df,
        granularity="month",
        forecast_model=app.state.forecast_model,
        iso_model=app.state.iso_model,
        config=config,
    )
    prewarmed_items: list[PeriodItem] = []
    for _, row in period_df.iterrows():
        prewarmed_items.append(
            PeriodItem(
                period=str(row["period"]),
                solar_kwh=round(float(row["solar_kwh"]), 2),
                load_kwh=round(float(row["load_kwh"]), 2),
                grid_only_cost=round(float(row["grid_only_cost"]), 2),
                rule_based_cost=round(float(row["rule_based_cost"]), 2),
                optimised_cost=round(float(row["optimised_cost"]), 2),
                savings_amount=round(float(row["savings_opt_kwh"]), 2),
                savings_percent=round(float(row["savings_opt_pct"]), 2),
                solar_self_consumption_percent=round(float(row["self_consumption_pct"]), 2),
                battery_cycles=round(float(row["battery_cycles"]), 2),
                fault_hours=int(row["fault_hours"]),
            )
        )
    app.state.period_summary_cache[(2026, "month")] = PeriodSummaryResponse(
        year=2026,
        granularity="month",
        currency=config.tariff.currency,
        periods=prewarmed_items,
    )

    yield


app = FastAPI(
    title="AI-Based Renewable Energy Management System API",
    version="1.0.0",
    description="Software-only REST API for microgrid energy simulation, forecasting, and optimisation.",
    lifespan=lifespan,
)

# Enable CORS for React frontend (Vite default on port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _slice_and_validate_range(
    df: pd.DataFrame,
    start: Optional[str],
    end: Optional[str],
    max_days: int = 31,
) -> pd.DataFrame:
    """Validate user timestamps and slice DataFrame horizon within strict limits."""
    min_ts = str(df.iloc[0]["timestamp"])
    max_ts = str(df.iloc[-1]["timestamp"])

    if start is None:
        start = min_ts
    if end is None:
        # Default to 24 hours after start
        start_idx = df[df["timestamp"] == start].index
        if len(start_idx) > 0:
            end_idx = min(len(df) - 1, start_idx[0] + 23)
            end = str(df.iloc[end_idx]["timestamp"])
        else:
            end = max_ts

    # Check temporal ordering
    if start > end:
        raise HTTPException(
            status_code=422,
            detail=f"Start timestamp '{start}' must be before or equal to end timestamp '{end}'.",
        )

    # Check bounds inside dataset
    if start < min_ts or end > max_ts:
        raise HTTPException(
            status_code=422,
            detail=f"Requested range [{start}, {end}] is outside dataset range [{min_ts}, {max_ts}].",
        )

    slice_df = df[(df["timestamp"] >= start) & (df["timestamp"] <= end)].copy().reset_index(drop=True)
    if len(slice_df) == 0:
        raise HTTPException(status_code=422, detail="No hourly observations found in the requested range.")

    max_hours = max_days * 24
    if len(slice_df) > max_hours:
        raise HTTPException(
            status_code=422,
            detail=f"Requested horizon exceeds maximum allowed limit of {max_days} days ({max_hours} hours). Got {len(slice_df)} hours.",
        )

    return slice_df


@app.get("/health", response_model=HealthResponse)
@app.get("/api/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """Check backend operational health, loaded dataset range, and model availability."""
    return HealthResponse(
        status="healthy",
        service="renewable_ai_api",
        min_timestamp=app.state.min_timestamp,
        max_timestamp=app.state.max_timestamp,
        total_rows=len(app.state.df),
        forecast_model_loaded=app.state.forecast_model is not None,
        iso_model_loaded=app.state.iso_model is not None,
    )


@app.get("/api/meta", response_model=MetaResponse)
def get_metadata() -> MetaResponse:
    """Retrieve system configuration metadata, default ratings, and tariff schedules."""
    config: SystemConfig = app.state.config
    return MetaResponse(
        min_timestamp=app.state.min_timestamp,
        max_timestamp=app.state.max_timestamp,
        total_days=config.data.days,
        currency=config.tariff.currency,
        strategies=["grid_only", "rule_based", "optimised_lp"],
        solar_defaults={
            "capacity_kwp": config.solar.capacity_kwp,
            "derate": config.solar.derate,
            "temp_coeff": config.solar.temp_coeff,
        },
        battery_defaults={
            "capacity_kwh": config.battery.capacity_kwh,
            "max_power_kw": config.battery.max_power_kw,
            "charge_eff": config.battery.charge_eff,
            "discharge_eff": config.battery.discharge_eff,
            "min_soc": config.battery.min_soc,
            "max_soc": config.battery.max_soc,
            "initial_soc": config.battery.initial_soc,
        },
        tariff_defaults={
            "off_peak_price": config.tariff.off_peak_price,
            "normal_price": config.tariff.normal_price,
            "peak_price": config.tariff.peak_price,
            "export_price": config.tariff.export_price,
            "currency": config.tariff.currency,
        },
    )


@app.get("/api/simulate", response_model=SimulateResponse)
def simulate(
    start: Optional[str] = Query(None, description="Start timestamp (YYYY-MM-DD HH:MM:SS)"),
    end: Optional[str] = Query(None, description="End timestamp (YYYY-MM-DD HH:MM:SS)"),
    strategy: str = Query("optimised_lp", description="Strategy: 'grid_only', 'rule_based', 'optimised_lp'"),
    battery_kwh: float = Query(10.0, ge=1.0, le=50.0, description="Battery capacity in kWh (1.0 to 50.0)"),
    battery_kw: float = Query(5.0, ge=1.0, le=20.0, description="Battery max power in kW (1.0 to 20.0)"),
) -> SimulateResponse:
    """Run closed-loop microgrid simulation over a specified horizon."""
    valid_strategies = ["grid_only", "rule_based", "optimised_lp"]
    if strategy not in valid_strategies:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid strategy '{strategy}'. Must be one of: {valid_strategies}",
        )

    df_slice = _slice_and_validate_range(app.state.df, start, end, max_days=31)
    b_cfg = BatteryConfig(capacity_kwh=battery_kwh, max_power_kw=battery_kw)

    # Run chosen strategy
    res_df, summary = run_simulation(
        df_horizon=df_slice,
        strategy=strategy,
        battery_config=b_cfg,
        forecast_model=app.state.forecast_model,
        iso_model=app.state.iso_model,
        config=app.state.config,
    )

    # Run baseline (grid-only) for deltas
    _, baseline_summary = run_simulation(
        df_horizon=df_slice,
        strategy="grid_only",
        battery_config=b_cfg,
        forecast_model=app.state.forecast_model,
        iso_model=app.state.iso_model,
        config=app.state.config,
    )

    # Format hourly telemetry
    series: list[HourlyTelemetryPoint] = []
    cap = b_cfg.capacity_kwh
    for _, row in res_df.iterrows():
        series.append(
            HourlyTelemetryPoint(
                timestamp=str(row["timestamp"]),
                solar_predicted_kw=round(float(row["solar_kw_predicted"]), 2),
                solar_actual_kw=round(float(row["solar_kw_actual"]), 2),
                load_kw=round(float(row["building_load_kw"]), 2),
                battery_charge_kw=round(float(row["battery_charge_kw"]), 2),
                battery_discharge_kw=round(float(row["battery_discharge_kw"]), 2),
                soc_pct=round((float(row["battery_soc_kwh"]) / cap) * 100.0, 2),
                grid_import_kw=round(float(row["grid_import_kw"]), 2),
                grid_export_kw=round(float(row["grid_export_kw"]), 2),
                price=round(float(row["grid_price_per_kwh"]), 2),
                fault_flag=int(row["is_fault_detected"]),
                fault_severity=str(row["fault_severity"]),
            )
        )

    return SimulateResponse(
        horizon_start=str(df_slice.iloc[0]["timestamp"]),
        horizon_end=str(df_slice.iloc[-1]["timestamp"]),
        hours=len(df_slice),
        strategy=strategy,
        hourly_series=series,
        summary=SimulationSummaryKPIs(**summary),
        baseline=SimulationSummaryKPIs(**baseline_summary),
    )


@app.get("/api/compare", response_model=CompareResponse)
def compare_strategies(
    start: Optional[str] = Query(None, description="Start timestamp (YYYY-MM-DD HH:MM:SS)"),
    end: Optional[str] = Query(None, description="End timestamp (YYYY-MM-DD HH:MM:SS)"),
    battery_kwh: float = Query(10.0, ge=1.0, le=50.0, description="Battery capacity in kWh"),
    battery_kw: float = Query(5.0, ge=1.0, le=20.0, description="Battery max power in kW"),
) -> CompareResponse:
    """Compare all three dispatch strategies side-by-side with cumulative cost series."""
    df_slice = _slice_and_validate_range(app.state.df, start, end, max_days=31)
    b_cfg = BatteryConfig(capacity_kwh=battery_kwh, max_power_kw=battery_kw)

    all_strat_res = run_all_strategies(
        df_horizon=df_slice,
        battery_config=b_cfg,
        config=app.state.config,
    )

    df_grid, s_grid = all_strat_res["grid_only"]
    df_rule, s_rule = all_strat_res["rule_based"]
    df_opt, s_opt = all_strat_res["optimised_lp"]

    cum_grid = np.cumsum(df_grid["electricity_cost"].to_numpy())
    cum_rule = np.cumsum(df_rule["electricity_cost"].to_numpy())
    cum_opt = np.cumsum(df_opt["electricity_cost"].to_numpy())

    cum_series: list[CumulativeCostPoint] = []
    for i in range(len(df_slice)):
        cum_series.append(
            CumulativeCostPoint(
                timestamp=str(df_slice.iloc[i]["timestamp"]),
                grid_only=round(float(cum_grid[i]), 2),
                rule_based=round(float(cum_rule[i]), 2),
                optimised_lp=round(float(cum_opt[i]), 2),
            )
        )

    return CompareResponse(
        horizon_start=str(df_slice.iloc[0]["timestamp"]),
        horizon_end=str(df_slice.iloc[-1]["timestamp"]),
        hours=len(df_slice),
        currency=app.state.config.tariff.currency,
        strategies={
            "grid_only": SimulationSummaryKPIs(**s_grid),
            "rule_based": SimulationSummaryKPIs(**s_rule),
            "optimised_lp": SimulationSummaryKPIs(**s_opt),
        },
        cumulative_cost_series=cum_series,
    )


@app.get("/api/outlook", response_model=OutlookResponse)
def get_outlook(
    start: Optional[str] = Query(None, description="Starting timestamp for 24-hour window"),
) -> OutlookResponse:
    """Predict solar generation, load demand, and recommended battery schedule for next 24 hours."""
    df: pd.DataFrame = app.state.df
    if start is None:
        start = str(df.iloc[0]["timestamp"])

    min_ts = str(df.iloc[0]["timestamp"])
    max_ts = str(df.iloc[-1]["timestamp"])

    if start < min_ts or start > max_ts:
        raise HTTPException(
            status_code=422,
            detail=f"Start timestamp '{start}' is outside dataset range [{min_ts}, {max_ts}].",
        )

    outlook_data = get_24h_forecast(
        df,
        start_timestamp=start,
        forecast_model=app.state.forecast_model,
        iso_model=app.state.iso_model,
        config=app.state.config,
    )
    fc_table: pd.DataFrame = outlook_data["forecast_table"]
    cap = app.state.config.battery.capacity_kwh

    points: list[OutlookSchedulePoint] = []
    for _, row in fc_table.iterrows():
        points.append(
            OutlookSchedulePoint(
                timestamp=str(row["timestamp"]),
                hour=int(row["hour"]),
                solar_predicted_kw=round(float(row["solar_kw_predicted"]), 2),
                building_load_kw=round(float(row["building_load_kw"]), 2),
                battery_charge_kw=round(float(row["battery_charge_kw"]), 2),
                battery_discharge_kw=round(float(row["battery_discharge_kw"]), 2),
                soc_pct=round((float(row["battery_soc_kwh"]) / cap) * 100.0, 2),
                grid_import_kw=round(float(row["grid_import_kw"]), 2),
                grid_export_kw=round(float(row["grid_export_kw"]), 2),
                grid_price=round(float(row["grid_price_per_kwh"]), 2),
            )
        )

    return OutlookResponse(
        start_timestamp=outlook_data["start_timestamp"],
        end_timestamp=outlook_data["end_timestamp"],
        hours=24,
        expected_cost=round(float(outlook_data["summary"]["total_cost"]), 2),
        currency=app.state.config.tariff.currency,
        hourly_outlook=points,
    )


@app.get("/api/faults", response_model=FaultsResponse)
def get_fault_events(
    start: Optional[str] = Query(None, description="Start timestamp"),
    end: Optional[str] = Query(None, description="End timestamp"),
) -> FaultsResponse:
    """Retrieve detected PV array fault events within a given time window."""
    df_slice = _slice_and_validate_range(app.state.df, start, end, max_days=365)
    config: SystemConfig = app.state.config

    diagnosed = detect_faults(
        df_slice,
        forecast_model=app.state.forecast_model,
        iso_model=app.state.iso_model,
        config=config,
    )
    raw_events = extract_fault_events(diagnosed)

    event_items: list[FaultEventItem] = []
    total_energy_lost = 0.0
    total_cost_lost = 0.0

    for ev in raw_events:
        # Determine detection source within event duration
        mask = (diagnosed["timestamp"] >= ev["start"]) & (diagnosed["timestamp"] <= ev["end"])
        sub_df = diagnosed[mask]

        has_a = bool((sub_df["fault_method_a"] == 1).any())
        has_b = bool((sub_df["fault_method_b"] == 1).any())
        if has_a and has_b:
            source = "Both"
        elif has_a:
            source = "Residual Threshold"
        else:
            source = "Isolation Forest"

        # Economic loss: sum of residual * hourly import price
        event_prices = [config.tariff.get_import_price(int(h)) for h in sub_df["hour"]]
        event_cost_loss = float(np.sum(sub_df["residual_kw"].to_numpy() * np.array(event_prices)))
        event_cost_loss = max(0.0, event_cost_loss)

        total_energy_lost += ev["energy_lost_kwh"]
        total_cost_lost += event_cost_loss

        event_items.append(
            FaultEventItem(
                start=ev["start"],
                end=ev["end"],
                duration_h=ev["duration_h"],
                severity=ev["severity"],
                energy_lost_kwh=round(float(ev["energy_lost_kwh"]), 2),
                cost_lost=round(event_cost_loss, 2),
                detected_by=source,
            )
        )

    return FaultsResponse(
        total_events=len(event_items),
        total_energy_lost_kwh=round(total_energy_lost, 2),
        total_cost_lost=round(total_cost_lost, 2),
        currency=config.tariff.currency,
        events=event_items,
    )


@app.get("/api/period-summary", response_model=PeriodSummaryResponse)
def get_period_summary(
    year: Optional[int] = Query(2026, description="Calendar year for breakdown"),
    granularity: str = Query("month", description="Temporal granularity ('month')"),
) -> PeriodSummaryResponse:
    """Retrieve monthly energy balances, costs, and solar self-consumption over the year."""
    if not hasattr(app.state, "period_summary_cache"):
        app.state.period_summary_cache = {}

    cache_key = (year or 2026, granularity)
    if cache_key in app.state.period_summary_cache:
        return app.state.period_summary_cache[cache_key]

    df: pd.DataFrame = app.state.df
    period_df = run_period(
        df,
        granularity=granularity,
        forecast_model=app.state.forecast_model,
        iso_model=app.state.iso_model,
        config=app.state.config,
    )

    items: list[PeriodItem] = []
    for _, row in period_df.iterrows():
        items.append(
            PeriodItem(
                period=str(row["period"]),
                solar_kwh=round(float(row["solar_kwh"]), 2),
                load_kwh=round(float(row["load_kwh"]), 2),
                grid_only_cost=round(float(row["grid_only_cost"]), 2),
                rule_based_cost=round(float(row["rule_based_cost"]), 2),
                optimised_cost=round(float(row["optimised_cost"]), 2),
                savings_amount=round(float(row["savings_opt_kwh"]), 2),
                savings_percent=round(float(row["savings_opt_pct"]), 2),
                solar_self_consumption_percent=round(float(row["self_consumption_pct"]), 2),
                battery_cycles=round(float(row["battery_cycles"]), 2),
                fault_hours=int(row["fault_hours"]),
            )
        )

    resp = PeriodSummaryResponse(
        year=year or 2026,
        granularity=granularity,
        currency=app.state.config.tariff.currency,
        periods=items,
    )
    app.state.period_summary_cache[cache_key] = resp
    return resp


@app.get("/api/model-performance", response_model=ModelPerformanceResponse)
def get_model_performance() -> ModelPerformanceResponse:
    """Retrieve offline training benchmarks for forecasting and anomaly detection."""
    config: SystemConfig = app.state.config
    fc_path = config.models_dir / "forecast_metrics.json"
    flt_path = config.models_dir / "fault_metrics.json"

    with open(fc_path, "r", encoding="utf-8") as f:
        fc_metrics = json.load(f)
    with open(flt_path, "r", encoding="utf-8") as f:
        flt_metrics = json.load(f)

    return ModelPerformanceResponse(
        forecast_metrics=fc_metrics,
        fault_metrics=flt_metrics,
    )
