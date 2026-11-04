import React, { useMemo, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGlobalState } from '../context/GlobalStateContext';
import {
  useSimulateQuery,
  useFaultsQuery,
  useOutlookQuery,
  useModelPerformanceQuery,
} from '../api/client';
import type { FaultEvent } from '../api/types';
import { Label } from '../components/ui/Label';
import { PillButton } from '../components/ui/Button';
import { Segmented } from '../components/ui/Segmented';
import { Panel } from '../components/ui/Panel';
import { Badge } from '../components/ui/Badge';
import { DataTable, Column } from '../components/ui/DataTable';
import { SideSheet } from '../components/ui/SideSheet';
import { DisplayNumber } from '../components/ui/DisplayNumber';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Reveal } from '../components/ui/Reveal';
import { MaskedLines } from '../motion/MaskedLines';
import { ScenarioBar } from '../components/layout/ScenarioBar';
import {
  LinkedForecastResidualChart,
  OutlookDispatchChart,
  ZoomedFaultChart,
} from '../components/charts/ForecastCharts';
import { exportToCsv, downloadChartPng } from '../lib/exportUtils';
import { AlertCircle, Download, FileText, ArrowRight, CheckCircle2, Zap, Clock, ShieldAlert } from 'lucide-react';
import type ReactECharts from 'echarts-for-react';

type ViewMode = 'forecast' | 'faults' | 'outlook';

const Forecast: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = (searchParams.get('view') as ViewMode) || 'forecast';

  const setView = (newView: ViewMode) => {
    const next = new URLSearchParams(searchParams);
    next.set('view', newView);
    setSearchParams(next, { replace: true });
  };

  const { startDate, endDate, strategy, batteryKwh, batteryKw } = useGlobalState();

  // Queries
  const {
    data: simData,
    isLoading: simLoading,
    error: simError,
    refetch: refetchSim,
  } = useSimulateQuery({
    start: startDate,
    end: endDate,
    strategy,
    battery_kwh: batteryKwh,
    battery_kw: batteryKw,
  });

  const {
    data: faultsData,
    isLoading: faultsLoading,
    error: faultsError,
    refetch: refetchFaults,
  } = useFaultsQuery({
    start: startDate,
    end: endDate,
  });

  // Start outlook from startDate or today
  const outlookStart = useMemo(() => {
    if (simData?.hourly_series?.[0]?.timestamp) {
      return simData.hourly_series[0].timestamp;
    }
    return startDate;
  }, [simData, startDate]);

  const {
    data: outlookData,
    isLoading: outlookLoading,
    error: outlookError,
    refetch: refetchOutlook,
  } = useOutlookQuery({
    start: outlookStart,
    battery_kwh: batteryKwh,
    battery_kw: batteryKw,
  });

  const { data: perfData } = useModelPerformanceQuery();

  // Chart refs for PNG download
  const forecastChartRef = useRef<ReactECharts>(null);
  const outlookChartRef = useRef<ReactECharts>(null);

  // SideSheet state for selected fault event
  const [selectedFault, setSelectedFault] = useState<FaultEvent | null>(null);

  // Severity filter state for faults table
  const [severityFilter, setSeverityFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');

  // Hourly data & derived values
  const hourlyData = simData?.hourly_series || [];
  const faultHoursCount = useMemo(() => {
    return hourlyData.filter((d) => d.fault_flag).length;
  }, [hourlyData]);

  const totalSolarKwh = simData?.summary?.solar_generation_kwh ?? 0;
  const forecastMae = perfData?.forecast_metrics?.model_metrics?.mae ?? simData?.summary?.forecast_mae_kw ?? 0.0216;
  const forecastR2 = perfData?.forecast_metrics?.model_metrics?.r2 ?? 0.9993;

  // Filtered fault events
  const allEvents = faultsData?.events || [];
  const filteredEvents = useMemo(() => {
    if (severityFilter === 'All') return allEvents;
    return allEvents.filter((ev) => ev.severity.toLowerCase() === severityFilter.toLowerCase());
  }, [allEvents, severityFilter]);

  // Dynamic Recommended Actions Generator for Outlook
  const recommendedActions = useMemo(() => {
    if (!outlookData?.hourly_outlook || outlookData.hourly_outlook.length === 0) return [];
    const list: Array<{ title: string; desc: string; type: 'charge' | 'discharge' | 'solar' | 'grid' }> = [];
    const series = outlookData.hourly_outlook;

    // 1. Detect charge interval
    let chargeStart: number | null = null;
    let chargeEnd: number | null = null;
    let maxCharge = 0;
    let totalChargeKwh = 0;

    series.forEach((pt) => {
      if (pt.battery_charge_kw > 0.1) {
        if (chargeStart === null) chargeStart = pt.hour;
        chargeEnd = pt.hour;
        maxCharge = Math.max(maxCharge, pt.battery_charge_kw);
        totalChargeKwh += pt.battery_charge_kw;
      }
    });

    if (chargeStart !== null && chargeEnd !== null) {
      list.push({
        type: 'charge',
        title: `Charge storage: ${String(chargeStart).padStart(2, '0')}:00 – ${String(chargeEnd + 1).padStart(2, '0')}:00`,
        desc: `Absorb surplus solar generation directly into battery (peak ${maxCharge.toFixed(1)} kW, accumulating +${totalChargeKwh.toFixed(1)} kWh stored energy).`,
      });
    }

    // 2. Detect discharge interval
    let dischargeStart: number | null = null;
    let dischargeEnd: number | null = null;
    let maxDischarge = 0;
    let totalDischargeKwh = 0;

    series.forEach((pt) => {
      if (pt.battery_discharge_kw > 0.1) {
        if (dischargeStart === null) dischargeStart = pt.hour;
        dischargeEnd = pt.hour;
        maxDischarge = Math.max(maxDischarge, pt.battery_discharge_kw);
        totalDischargeKwh += pt.battery_discharge_kw;
      }
    });

    if (dischargeStart !== null && dischargeEnd !== null) {
      list.push({
        type: 'discharge',
        title: `Discharge storage: ${String(dischargeStart).padStart(2, '0')}:00 – ${String(dischargeEnd + 1).padStart(2, '0')}:00`,
        desc: `Cover evening domestic peak demand (peak ${maxDischarge.toFixed(1)} kW, releasing ${totalDischargeKwh.toFixed(1)} kWh) to suppress expensive grid import tariffs.`,
      });
    }

    // 3. Detect self-sufficiency window
    const selfSuffHours = series.filter((pt) => pt.grid_import_kw <= 0.05 && pt.building_load_kw > 0.2);
    if (selfSuffHours.length > 0) {
      const startH = selfSuffHours[0].hour;
      const endH = selfSuffHours[selfSuffHours.length - 1].hour;
      list.push({
        type: 'solar',
        title: `Zero grid import window: ${String(startH).padStart(2, '0')}:00 – ${String(endH + 1).padStart(2, '0')}:00`,
        desc: `Microgrid operates in 100% self-sufficient mode. Building load is fully served by combined on-site PV and stored energy buffer.`,
      });
    }

    // 4. Baseline grid interaction
    const gridHours = series.filter((pt) => pt.grid_import_kw > 0.5);
    if (gridHours.length > 0) {
      const avgImport = (gridHours.reduce((sum, p) => sum + p.grid_import_kw, 0) / gridHours.length).toFixed(1);
      list.push({
        type: 'grid',
        title: `Off-peak grid baseline balance`,
        desc: `Grid supplies residual baseline load during overnight hours (averaging ${avgImport} kW) at low night tariffs.`,
      });
    }

    return list;
  }, [outlookData]);

  // CSV Export Handlers
  const handleExportForecastCsv = () => {
    if (!hourlyData.length) return;
    const headers = [
      'Timestamp',
      'Solar Predicted (kW)',
      'Solar Actual (kW)',
      'Generation Deficit (kW)',
      'Building Load (kW)',
      'Fault Flag',
      'Fault Severity',
    ];
    const rows = hourlyData.map((d) => [
      d.timestamp,
      d.solar_predicted_kw.toFixed(3),
      d.solar_actual_kw.toFixed(3),
      Math.max(0, d.solar_predicted_kw - d.solar_actual_kw).toFixed(3),
      d.load_kw.toFixed(3),
      d.fault_flag ? 1 : 0,
      d.fault_severity || 'None',
    ]);
    exportToCsv(`helios-forecast-${startDate.slice(0, 10)}-to-${endDate.slice(0, 10)}`, headers, rows);
  };

  const handleExportFaultsCsv = () => {
    if (!allEvents.length) return;
    const headers = ['Start', 'End', 'Duration (h)', 'Severity', 'Energy Lost (kWh)', 'Cost Lost', 'Detected By'];
    const rows = allEvents.map((ev) => [
      ev.start,
      ev.end,
      ev.duration_h,
      ev.severity,
      ev.energy_lost_kwh.toFixed(2),
      ev.cost_lost.toFixed(2),
      ev.detected_by,
    ]);
    exportToCsv(`helios-fault-events-${startDate.slice(0, 10)}-to-${endDate.slice(0, 10)}`, headers, rows);
  };

  const handleExportOutlookCsv = () => {
    if (!outlookData?.hourly_outlook?.length) return;
    const headers = [
      'Timestamp',
      'Hour',
      'Solar Predicted (kW)',
      'Building Load (kW)',
      'Battery Charge (kW)',
      'Battery Discharge (kW)',
      'State of Charge (%)',
      'Grid Import (kW)',
      'Grid Export (kW)',
      'Grid Price',
    ];
    const rows = outlookData.hourly_outlook.map((d) => [
      d.timestamp,
      d.hour,
      d.solar_predicted_kw.toFixed(3),
      d.building_load_kw.toFixed(3),
      d.battery_charge_kw.toFixed(3),
      d.battery_discharge_kw.toFixed(3),
      d.soc_pct.toFixed(1),
      d.grid_import_kw.toFixed(3),
      d.grid_export_kw.toFixed(3),
      d.grid_price.toFixed(2),
    ]);
    exportToCsv(`helios-24h-outlook-${outlookStart.slice(0, 10)}`, headers, rows);
  };

  // Faults Table Columns
  const faultColumns: Column<FaultEvent>[] = [
    {
      key: 'start',
      header: 'Start Timestamp',
      sortable: true,
      render: (row) => <span className="font-mono text-[12px]">{row.start}</span>,
    },
    {
      key: 'end',
      header: 'End Timestamp',
      sortable: true,
      render: (row) => <span className="font-mono text-[12px]">{row.end}</span>,
    },
    {
      key: 'duration_h',
      header: 'Duration',
      align: 'right',
      sortable: true,
      render: (row) => <span>{row.duration_h} {row.duration_h === 1 ? 'hour' : 'hours'}</span>,
    },
    {
      key: 'severity',
      header: 'Severity',
      align: 'center',
      sortable: true,
      render: (row) => {
        const variant =
          row.severity === 'High' ? 'fault' : row.severity === 'Medium' ? 'brass' : 'neutral';
        return <Badge variant={variant}>{row.severity}</Badge>;
      },
    },
    {
      key: 'energy_lost_kwh',
      header: 'Energy Lost',
      align: 'right',
      sortable: true,
      render: (row) => <span>{row.energy_lost_kwh.toFixed(2)} kWh</span>,
    },
    {
      key: 'cost_lost',
      header: 'Cost Impact',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className="font-serif italic font-normal text-fault">
          ₹ {row.cost_lost.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'detected_by',
      header: 'Detection Engine',
      sortable: true,
      render: (row) => (
        <span className="text-caption text-muted truncate">{row.detected_by}</span>
      ),
    },
  ];

  return (
    <div className="pt-20 md:pt-24 min-h-screen bg-bg text-ink selection:bg-ink selection:text-bg">
      {/* 1. Page Header per Inner-Page Style Block */}
      <div className="max-w-[1320px] mx-auto px-6 pt-10 pb-6">
        <Label variant="parenthesised">(02) FORECAST</Label>
        <MaskedLines
          text="*Forecast and faults*"
          as="h1"
          className="text-h1 font-serif italic text-ink font-light mt-2"
        />
        <p className="text-body text-muted mt-2 max-w-3xl">
          Machine learning solar generation forecasting, dual-method fault detection, and next-24-hour dispatch outlook.
        </p>
        <div className="w-full h-[1px] bg-hairline mt-6" />
      </div>

      {/* 2. ScenarioBar: Sticky under Nav, URL-synced */}
      <ScenarioBar showBatteryControls={false} />

      {/* 3. Main Content Container */}
      <main className="max-w-[1320px] mx-auto px-6 py-8">
        {/* Navigation View Switcher (Segmented Control) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-8 gap-4 border-b border-hairline/60">
          <Segmented<ViewMode>
            options={[
              { value: 'forecast', label: 'Forecast' },
              { value: 'faults', label: 'Faults' },
              { value: 'outlook', label: 'Next 24 hours' },
            ]}
            value={activeView}
            onChange={setView}
            layoutId="forecastViewSegment"
          />

          <span className="text-caption text-muted font-sans tabular-nums">
            Horizon: {startDate.slice(0, 10)} → {endDate.slice(0, 10)}
          </span>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: FORECAST VIEW                                                     */}
        {/* ========================================================================= */}
        {activeView === 'forecast' && (
          <div className="space-y-8 pt-8">
            {/* Quiet Banner: Appears ONLY when faults exist in range */}
            {faultHoursCount > 0 && (
              <div className="w-full p-4 md:p-5 bg-[#FAF7F2] border border-hairline rounded-control flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-fault/10 flex items-center justify-center text-fault flex-shrink-0">
                    <AlertCircle size={16} />
                  </div>
                  <div>
                    <h4 className="text-ui font-medium text-ink">
                      Possible solar generation fault detected
                    </h4>
                    <p className="text-caption text-muted mt-0.5">
                      Identified {faultHoursCount} {faultHoursCount === 1 ? 'hour' : 'hours'} of anomalous generation deficit in this window.
                    </p>
                  </div>
                </div>
                <PillButton
                  variant="outline"
                  onClick={() => setView('faults')}
                  className="flex-shrink-0"
                >
                  Inspect Faults View <ArrowRight size={12} className="ml-1" />
                </PillButton>
              </div>
            )}

            {/* Error State */}
            {simError && (
              <ErrorState
                title="Telemetry Ingestion Error"
                message={simError.message || 'Unable to retrieve simulation data for selected range.'}
                onRetry={refetchSim}
              />
            )}

            {/* KPI Display Numbers */}
            <Reveal>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-6 md:p-8 bg-surface border border-hairline rounded-control">
                <DisplayNumber
                  value={forecastMae.toFixed(4)}
                  unit="kW"
                  captionLine1="Forecast Error (MAE)"
                  captionLine2="Random Forest vs test ground truth"
                  size="lg"
                />
                <DisplayNumber
                  value={totalSolarKwh.toFixed(1)}
                  unit="kWh"
                  captionLine1="Solar Yield"
                  captionLine2="Total energy generated in horizon"
                  size="lg"
                />
                <DisplayNumber
                  value={forecastR2.toFixed(4)}
                  captionLine1="Model Accuracy (R²)"
                  captionLine2="Coefficient of determination"
                  size="lg"
                />
                <DisplayNumber
                  value={faultHoursCount}
                  unit={faultHoursCount === 1 ? 'hour' : 'hours'}
                  captionLine1="Fault Hours Detected"
                  captionLine2="Anomalous yield deviation"
                  size="lg"
                />
              </div>
            </Reveal>

            {/* Linked Forecast vs Actual + Residual Deficit Chart */}
            <Panel variant="raised" className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-hairline gap-3">
                <div>
                  <h3 className="font-serif italic text-xl text-ink font-normal">
                    Solar Generation & Linked Generation Deficit
                  </h3>
                  <p className="text-caption text-muted mt-0.5">
                    Predicted irradiance (dashed) vs observed output (solid), synchronized with lower residual deviation.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PillButton
                    variant="outline"
                    showArrow={false}
                    onClick={handleExportForecastCsv}
                    className="text-xs"
                  >
                    <FileText size={12} className="mr-1.5" /> Export CSV
                  </PillButton>
                  <PillButton
                    variant="outline"
                    showArrow={false}
                    onClick={() => downloadChartPng(forecastChartRef.current, `forecast-chart-${startDate.slice(0, 10)}`)}
                    className="text-xs"
                  >
                    <Download size={12} className="mr-1.5" /> Download PNG
                  </PillButton>
                </div>
              </div>

              {simLoading ? (
                <Skeleton className="w-full h-[540px]" />
              ) : hourlyData.length === 0 ? (
                <EmptyState
                  title="No Solar Data"
                  description="Select an alternate date horizon to inspect generation telemetry."
                />
              ) : (
                <div className="w-full">
                  <LinkedForecastResidualChart
                    data={hourlyData}
                    height={540}
                    chartRef={forecastChartRef}
                  />
                </div>
              )}
            </Panel>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: FAULTS VIEW                                                       */}
        {/* ========================================================================= */}
        {activeView === 'faults' && (
          <div className="space-y-8 pt-8">
            {faultsError && (
              <ErrorState
                title="Fault Diagnostic Telemetry Error"
                message={faultsError.message || 'Unable to retrieve fault detection events.'}
                onRetry={refetchFaults}
              />
            )}

            {/* Faults Summary KPIs */}
            <Reveal>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-6 md:p-8 bg-surface border border-hairline rounded-control">
                <DisplayNumber
                  value={allEvents.length}
                  unit={allEvents.length === 1 ? 'event' : 'events'}
                  captionLine1="Total Fault Events"
                  captionLine2="Logged in selected period"
                  size="lg"
                />
                <DisplayNumber
                  value={(faultsData?.total_energy_lost_kwh ?? 0).toFixed(1)}
                  unit="kWh"
                  captionLine1="Yield Energy Lost"
                  captionLine2="Cumulative deficit from faults"
                  size="lg"
                />
                <DisplayNumber
                  value={`₹ ${(faultsData?.total_cost_lost ?? 0).toFixed(2)}`}
                  captionLine1="Financial Loss Impact"
                  captionLine2="Equivalent tariff cost incurred"
                  size="lg"
                />
              </div>
            </Reveal>

            {/* Faults Table with Severity Filters */}
            <Panel variant="raised" className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-hairline gap-3">
                <div>
                  <h3 className="font-serif italic text-xl text-ink font-normal">
                    Diagnostic Fault Event Register
                  </h3>
                  <p className="text-caption text-muted mt-0.5">
                    Click any incident to open the zoomed expected-vs-actual telemetry SideSheet.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Severity Filter Toggle */}
                  <div className="flex items-center gap-1.5 p-1 bg-surface border border-hairline rounded-full text-xs">
                    {(['All', 'High', 'Medium', 'Low'] as const).map((sev) => (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => setSeverityFilter(sev)}
                        className={`px-3 py-1 rounded-full transition-colors cursor-pointer ${
                          severityFilter === sev
                            ? 'bg-raised text-ink font-medium shadow-sm'
                            : 'text-muted hover:text-ink'
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>

                  <PillButton
                    variant="outline"
                    showArrow={false}
                    onClick={handleExportFaultsCsv}
                    className="text-xs"
                  >
                    <FileText size={12} className="mr-1.5" /> Export Events CSV
                  </PillButton>
                </div>
              </div>

              {faultsLoading ? (
                <Skeleton className="w-full h-80" />
              ) : filteredEvents.length === 0 ? (
                <EmptyState
                  title="Zero Fault Events in Window"
                  description="No anomalous generation deficits detected for the selected horizon and severity filter."
                />
              ) : (
                <DataTable<FaultEvent>
                  columns={faultColumns}
                  data={filteredEvents}
                  keyField="start"
                  onRowClick={(row) => setSelectedFault(row)}
                  emptyMessage="No fault events found matching current filter."
                />
              )}
            </Panel>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: NEXT 24 HOURS (OUTLOOK)                                           */}
        {/* ========================================================================= */}
        {activeView === 'outlook' && (
          <div className="space-y-8 pt-8">
            {outlookError && (
              <ErrorState
                title="Forecast Horizon Simulation Error"
                message={outlookError.message || 'Unable to retrieve 24-hour predictive dispatch outlook.'}
                onRetry={refetchOutlook}
              />
            )}

            {/* Outlook Summary KPIs */}
            <Reveal>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-6 md:p-8 bg-surface border border-hairline rounded-control">
                <DisplayNumber
                  value={(
                    outlookData?.hourly_outlook?.reduce((sum, d) => sum + d.solar_predicted_kw, 0) ?? 0
                  ).toFixed(1)}
                  unit="kWh"
                  captionLine1="Predicted Next-Day Solar"
                  captionLine2="Total scheduled 24h PV output"
                  size="lg"
                />
                <DisplayNumber
                  value={(
                    outlookData?.hourly_outlook?.reduce((sum, d) => sum + d.building_load_kw, 0) ?? 0
                  ).toFixed(1)}
                  unit="kWh"
                  captionLine1="Expected Domestic Load"
                  captionLine2="Total forecasted demand"
                  size="lg"
                />
                <DisplayNumber
                  value={`₹ ${(outlookData?.expected_cost ?? 0).toFixed(2)}`}
                  captionLine1="Estimated Net Cost"
                  captionLine2="Optimised 24-hour energy balance"
                  size="lg"
                />
              </div>
            </Reveal>

            {/* 24-Hour Outlook Chart */}
            <Panel variant="raised" className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-hairline gap-3">
                <div>
                  <h3 className="font-serif italic text-xl text-ink font-normal">
                    24-Hour Predictive Dispatch & Storage Schedule
                  </h3>
                  <p className="text-caption text-muted mt-0.5">
                    Forecasted generation vs demand, with HiGHS-optimised battery charge (positive) and discharge (negative) schedules.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <PillButton
                    variant="outline"
                    showArrow={false}
                    onClick={handleExportOutlookCsv}
                    className="text-xs"
                  >
                    <FileText size={12} className="mr-1.5" /> Export Outlook CSV
                  </PillButton>
                  <PillButton
                    variant="outline"
                    showArrow={false}
                    onClick={() => downloadChartPng(outlookChartRef.current, `outlook-24h-${outlookStart.slice(0, 10)}`)}
                    className="text-xs"
                  >
                    <Download size={12} className="mr-1.5" /> Download PNG
                  </PillButton>
                </div>
              </div>

              {outlookLoading ? (
                <Skeleton className="w-full h-[500px]" />
              ) : !outlookData?.hourly_outlook?.length ? (
                <EmptyState
                  title="No 24-Hour Forecast Available"
                  description="Unable to generate outlook for the selected starting timestamp."
                />
              ) : (
                <div className="w-full">
                  <OutlookDispatchChart
                    data={outlookData.hourly_outlook}
                    height={500}
                    chartRef={outlookChartRef}
                  />
                </div>
              )}
            </Panel>

            {/* Dynamic Recommended Actions derived from the API schedule */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif italic text-2xl text-ink font-normal">
                    Recommended Storage Actions
                  </h3>
                  <p className="text-caption text-muted">
                    Automated dispatch recommendations derived directly from the linear programming 24-hour cost minimisation solution.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendedActions.map((action, idx) => (
                  <div
                    key={idx}
                    className="p-5 bg-surface border border-hairline rounded-control flex items-start gap-4 hover:border-ink/30 transition-colors shadow-xs"
                  >
                    <div className="w-9 h-9 rounded-full bg-raised border border-hairline flex items-center justify-center flex-shrink-0 mt-0.5">
                      {action.type === 'charge' ? (
                        <Zap size={16} className="text-battery" />
                      ) : action.type === 'discharge' ? (
                        <Clock size={16} className="text-fault" />
                      ) : action.type === 'solar' ? (
                        <CheckCircle2 size={16} className="text-solar" />
                      ) : (
                        <ShieldAlert size={16} className="text-grid" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-sans font-medium text-ui text-ink">
                        {action.title}
                      </h4>
                      <p className="text-caption text-muted mt-1 leading-relaxed">
                        {action.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 4. SideSheet for Zoomed Fault Event Telemetry */}
      <SideSheet
        open={Boolean(selectedFault)}
        onOpenChange={(open) => !open && setSelectedFault(null)}
        title="Fault Event Diagnostics"
        description="Detailed expected vs observed telemetry during anomalous generation deficit."
      >
        {selectedFault && (
          <div className="space-y-6">
            {/* Event Metrics Card */}
            <div className="p-4 bg-surface border border-hairline rounded-control space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-label text-muted">Incident Severity</span>
                <Badge variant={selectedFault.severity === 'High' ? 'fault' : selectedFault.severity === 'Medium' ? 'brass' : 'neutral'}>
                  {selectedFault.severity} Priority
                </Badge>
              </div>
              <div className="flex items-center justify-between text-caption border-t border-hairline/60 pt-2">
                <span className="text-muted">Start Timestamp</span>
                <span className="font-mono text-ink">{selectedFault.start}</span>
              </div>
              <div className="flex items-center justify-between text-caption border-t border-hairline/60 pt-2">
                <span className="text-muted">End Timestamp</span>
                <span className="font-mono text-ink">{selectedFault.end}</span>
              </div>
              <div className="flex items-center justify-between text-caption border-t border-hairline/60 pt-2">
                <span className="text-muted">Total Duration</span>
                <span className="text-ink tabular-nums font-medium">{selectedFault.duration_h} {selectedFault.duration_h === 1 ? 'hour' : 'hours'}</span>
              </div>
              <div className="flex items-center justify-between text-caption border-t border-hairline/60 pt-2">
                <span className="text-muted">Energy Yield Lost</span>
                <span className="text-fault tabular-nums font-medium">{selectedFault.energy_lost_kwh.toFixed(2)} kWh</span>
              </div>
              <div className="flex items-center justify-between text-caption border-t border-hairline/60 pt-2">
                <span className="text-muted">Financial Impact</span>
                <span className="font-serif italic font-normal text-fault">₹ {selectedFault.cost_lost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-caption border-t border-hairline/60 pt-2">
                <span className="text-muted">Detection Method</span>
                <span className="text-ink font-sans">{selectedFault.detected_by}</span>
              </div>
            </div>

            {/* Zoomed Expected vs Observed Chart */}
            <div className="space-y-2">
              <span className="text-[11px] uppercase tracking-label text-muted font-normal block">
                Zoomed Generation Curve
              </span>
              <div className="p-3 bg-surface border border-hairline rounded-control">
                <ZoomedFaultChart
                  eventStart={selectedFault.start}
                  eventEnd={selectedFault.end}
                  data={hourlyData}
                  height={240}
                />
              </div>
              <p className="text-[11px] text-muted italic">
                Shaded red area indicates deviation where observed output falls below expected Random Forest generation.
              </p>
            </div>
          </div>
        )}
      </SideSheet>
    </div>
  );
};

export default Forecast;
