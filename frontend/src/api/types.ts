/**
 * TypeScript API interfaces mirroring FastAPI schemas in api/schemas.py.
 */

export interface HealthResponse {
  status: string;
  service: string;
  min_timestamp: string;
  max_timestamp: string;
  total_rows: number;
  forecast_model_loaded: boolean;
  iso_model_loaded: boolean;
}

export interface SolarConfigModel {
  capacity_kwp: number;
  derate: number;
  temp_coeff: number;
}

export interface BatteryConfigModel {
  capacity_kwh: number;
  max_power_kw: number;
  charge_eff: number;
  discharge_eff: number;
  min_soc: number;
  max_soc: number;
  initial_soc: number;
}

export interface TariffConfigModel {
  off_peak_import: number;
  normal_import: number;
  peak_import: number;
  export_price: number;
  currency: string;
}

export interface MetaResponse {
  min_timestamp: string;
  max_timestamp: string;
  total_days: number;
  currency: string;
  strategies: string[];
  solar_defaults: SolarConfigModel;
  battery_defaults: BatteryConfigModel;
  tariff_defaults: TariffConfigModel;
}

export interface HourlySimPoint {
  timestamp: string;
  solar_predicted_kw: number;
  solar_actual_kw: number;
  load_kw: number;
  battery_charge_kw: number;
  battery_discharge_kw: number;
  soc_pct: number;
  grid_import_kw: number;
  grid_export_kw: number;
  price: number;
  fault_flag: number;
  fault_severity: string;
}

export interface SimulationKPIs {
  strategy: string;
  strategy_name: string;
  total_cost: number;
  grid_only_cost: number;
  savings_amount: number;
  savings_percent: number;
  grid_import_kwh: number;
  grid_export_kwh: number;
  solar_generation_kwh: number;
  building_load_kwh: number;
  solar_self_consumption_percent: number;
  battery_cycles: number;
  fault_hours: number;
  forecast_mae_kw: number;
}

export interface SimulateResponse {
  horizon_start: string;
  horizon_end: string;
  hours: number;
  strategy: string;
  hourly_series: HourlySimPoint[];
  summary: SimulationKPIs;
  baseline_grid_only: SimulationKPIs;
}

export interface CumulativeCostPoint {
  timestamp: string;
  grid_only: number;
  rule_based: number;
  optimised_lp: number;
}

export interface CompareResponse {
  horizon_start: string;
  horizon_end: string;
  hours: number;
  currency: string;
  strategies: Record<string, SimulationKPIs>;
  cumulative_cost_series: CumulativeCostPoint[];
  cumulative_costs?: CumulativeCostPoint[];
}

export interface HourlyOutlookPoint {
  timestamp: string;
  hour: number;
  solar_predicted_kw: number;
  building_load_kw: number;
  battery_charge_kw: number;
  battery_discharge_kw: number;
  soc_pct: number;
  grid_import_kw: number;
  grid_export_kw: number;
  grid_price: number;
}

export interface OutlookResponse {
  start_timestamp: string;
  end_timestamp: string;
  hours: number;
  expected_cost: number;
  currency: string;
  hourly_outlook: HourlyOutlookPoint[];
}

export interface FaultEvent {
  start: string;
  end: string;
  duration_h: number;
  severity: 'Low' | 'Medium' | 'High';
  energy_lost_kwh: number;
  cost_lost: number;
  detected_by: string;
}

export interface FaultsResponse {
  total_events: number;
  total_energy_lost_kwh: number;
  total_cost_lost: number;
  currency: string;
  events: FaultEvent[];
}

export interface PeriodSummaryItem {
  period: string;
  solar_kwh: number;
  load_kwh: number;
  grid_only_cost: number;
  rule_based_cost: number;
  optimised_cost: number;
  savings_amount: number;
  savings_percent: number;
  solar_self_consumption_percent: number;
  battery_cycles: number;
  fault_hours: number;
}

export interface PeriodSummaryResponse {
  year: number;
  granularity: string;
  currency: string;
  periods: PeriodSummaryItem[];
}

export interface ScatterPoint {
  actual: number;
  predicted: number;
  naive?: number;
  timestamp?: string;
}

export interface FeatureImportanceItem {
  feature: string;
  importance: number;
}

export interface ForecastMetricsData {
  model_metrics: {
    mae: number;
    rmse: number;
    r2: number;
  };
  baseline_metrics: {
    mae: number;
    rmse: number;
    r2: number;
  };
  evaluation_summary?: {
    train_samples_healthy?: number;
    test_samples_healthy?: number;
    mae_improvement_percent?: number;
    model_beats_baseline?: boolean;
    [key: string]: unknown;
  };
  feature_importances?: FeatureImportanceItem[] | Record<string, number>;
  test_samples?: ScatterPoint[];
  scatter_sample_test?: ScatterPoint[];
}

export interface FaultMethodMetrics {
  precision: number;
  recall: number;
  f1_score?: number;
  f1?: number;
  confusion_matrix?: number[][];
  true_positives?: number;
  false_positives?: number;
  true_negatives?: number;
  false_negatives?: number;
}

export interface FaultMetricsData {
  method_a_residual_threshold?: FaultMethodMetrics;
  method_a_threshold?: FaultMethodMetrics;
  method_b_isolation_forest?: FaultMethodMetrics;
  combined_hybrid?: FaultMethodMetrics;
  detected_events_summary?: {
    total_events: number;
    total_energy_lost_kwh: number;
    severity_counts: Record<string, number>;
  };
  [key: string]: unknown;
}

export interface ModelPerformanceResponse {
  forecast_metrics: ForecastMetricsData;
  fault_metrics: FaultMetricsData;
}

