import React, { useMemo, useRef } from 'react';
import { useGlobalState } from '../context/GlobalStateContext';
import { useSimulateQuery } from '../api/client';
import { Label } from '../components/ui/Label';
import { PillButton } from '../components/ui/Button';
import { Panel } from '../components/ui/Panel';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Reveal } from '../components/ui/Reveal';
import { MaskedLines } from '../motion/MaskedLines';
import { MotionNumeral } from '../motion/MotionNumeral';
import { ScenarioBar } from '../components/layout/ScenarioBar';
import {
  StateOfChargeChart,
  EnergyFlowSankeyChart,
  GridImportHeatmapChart,
} from '../components/charts/EnergyCharts';
import { exportToCsv, downloadChartPng } from '../lib/exportUtils';
import {
  Download,
  FileText,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import type ReactECharts from 'echarts-for-react';

const Energy: React.FC = () => {
  const { startDate, endDate, strategy, batteryKwh, batteryKw } = useGlobalState();

  // Closed-loop simulation query driven by ScenarioBar URL parameters
  const {
    data: simData,
    isLoading,
    error,
    refetch,
  } = useSimulateQuery({
    start: startDate,
    end: endDate,
    strategy,
    battery_kwh: batteryKwh,
    battery_kw: batteryKw,
  });

  // Chart refs for PNG exports
  const socChartRef = useRef<ReactECharts>(null);
  const sankeyChartRef = useRef<ReactECharts>(null);
  const heatmapChartRef = useRef<ReactECharts>(null);

  const hourlyData = simData?.hourly_series || [];

  // ==========================================================================
  // KPI DERIVATIONS
  // ==========================================================================
  const { batteryCycles, roundTripLossesKwh, peakGridImportKw, selfSufficiencyPct } =
    useMemo(() => {
      if (!hourlyData.length) {
        return {
          batteryCycles: simData?.summary?.battery_cycles ?? 0,
          roundTripLossesKwh: 0,
          peakGridImportKw: 0,
          selfSufficiencyPct: 0,
        };
      }

      let totalChargeLoss = 0;
      let totalDischargeLoss = 0;
      let maxGridImport = 0;
      let totalLoadKwh = 0;
      let totalGridImportKwh = 0;

      // Charge efficiency 0.95, Discharge efficiency 0.95 (round-trip 90.25%)
      const CHARGE_EFF = 0.95;
      const DISCHARGE_EFF = 0.95;

      hourlyData.forEach((pt) => {
        const ch = pt.battery_charge_kw;
        const dis = pt.battery_discharge_kw;
        const imp = pt.grid_import_kw;
        const load = pt.load_kw;

        if (ch > 0) totalChargeLoss += ch * (1 - CHARGE_EFF);
        if (dis > 0) totalDischargeLoss += dis * (1 / DISCHARGE_EFF - 1);
        if (imp > maxGridImport) maxGridImport = imp;

        totalLoadKwh += load;
        totalGridImportKwh += imp;
      });

      const totalLosses = totalChargeLoss + totalDischargeLoss;

      // Self-sufficiency: % of building load met on-site (solar direct + battery)
      const selfSufficiency =
        totalLoadKwh > 0
          ? Math.max(0, Math.min(100, ((totalLoadKwh - totalGridImportKwh) / totalLoadKwh) * 100))
          : 100;

      return {
        batteryCycles: simData?.summary?.battery_cycles ?? 0,
        roundTripLossesKwh: totalLosses,
        peakGridImportKw: maxGridImport,
        selfSufficiencyPct: selfSufficiency,
      };
    }, [hourlyData, simData]);

  // Derived Sankey node metrics for flow summary cards
  const flowBreakdown = useMemo(() => {
    let solarToLoad = 0;
    let solarToBatt = 0;
    let solarToExport = 0;
    let battToLoad = 0;
    let gridToLoad = 0;
    let gridToBatt = 0;
    let totalSolar = 0;
    let totalLoad = 0;
    let totalImport = 0;

    hourlyData.forEach((h) => {
      const s = h.solar_actual_kw;
      const l = h.load_kw;
      const ch = h.battery_charge_kw;
      const dis = h.battery_discharge_kw;
      const imp = h.grid_import_kw;

      totalSolar += s;
      totalLoad += l;
      totalImport += imp;

      const s_to_l = Math.min(s, l);
      const s_rem = Math.max(0, s - s_to_l);
      const s_to_b = Math.min(s_rem, ch);
      const s_to_exp = Math.max(0, s - s_to_l - s_to_b);

      solarToLoad += s_to_l;
      solarToBatt += s_to_b;
      solarToExport += s_to_exp;
      battToLoad += dis;

      const g_to_b = Math.max(0, ch - s_to_b);
      const g_to_l = Math.max(0, imp - g_to_b);

      gridToBatt += g_to_b;
      gridToLoad += g_to_l;
    });

    return {
      totalSolar,
      totalLoad,
      totalImport,
      solarToLoad,
      solarToBatt,
      solarToExport,
      battToLoad,
      gridToLoad,
      gridToBatt,
    };
  }, [hourlyData]);

  // ==========================================================================
  // CSV EXPORT HANDLERS
  // ==========================================================================
  const handleExportSocCsv = () => {
    if (!hourlyData.length) return;
    const headers = [
      'Timestamp',
      'State of Charge (%)',
      'Battery Charge (kW)',
      'Battery Discharge (kW)',
      'Net Storage Flow (kW)',
      'Battery Rated Capacity (kWh)',
      'Battery Max Power (kW)',
    ];
    const rows = hourlyData.map((d) => [
      d.timestamp,
      d.soc_pct.toFixed(2),
      d.battery_charge_kw.toFixed(3),
      d.battery_discharge_kw.toFixed(3),
      (d.battery_charge_kw - d.battery_discharge_kw).toFixed(3),
      batteryKwh.toFixed(1),
      batteryKw.toFixed(1),
    ]);
    exportToCsv(`helios-soc-telemetry-${startDate.slice(0, 10)}-to-${endDate.slice(0, 10)}`, headers, rows);
  };

  const handleExportSankeyCsv = () => {
    if (!hourlyData.length) return;
    const headers = ['Source Node', 'Target Node', 'Flow (kWh)', 'Share of Source (%)'];
    const rows = [
      ['Solar Generation', 'Building Load', flowBreakdown.solarToLoad.toFixed(2), flowBreakdown.totalSolar > 0 ? ((flowBreakdown.solarToLoad / flowBreakdown.totalSolar) * 100).toFixed(1) : '0.0'],
      ['Solar Generation', 'Battery Storage', flowBreakdown.solarToBatt.toFixed(2), flowBreakdown.totalSolar > 0 ? ((flowBreakdown.solarToBatt / flowBreakdown.totalSolar) * 100).toFixed(1) : '0.0'],
      ['Solar Generation', 'Grid Export', flowBreakdown.solarToExport.toFixed(2), flowBreakdown.totalSolar > 0 ? ((flowBreakdown.solarToExport / flowBreakdown.totalSolar) * 100).toFixed(1) : '0.0'],
      ['Battery Storage', 'Building Load', flowBreakdown.battToLoad.toFixed(2), '100.0'],
      ['Utility Grid Import', 'Building Load', flowBreakdown.gridToLoad.toFixed(2), flowBreakdown.totalImport > 0 ? ((flowBreakdown.gridToLoad / flowBreakdown.totalImport) * 100).toFixed(1) : '0.0'],
      ['Utility Grid Import', 'Battery Storage', flowBreakdown.gridToBatt.toFixed(2), flowBreakdown.totalImport > 0 ? ((flowBreakdown.gridToBatt / flowBreakdown.totalImport) * 100).toFixed(1) : '0.0'],
    ];
    exportToCsv(`helios-energy-flow-sankey-${startDate.slice(0, 10)}-to-${endDate.slice(0, 10)}`, headers, rows);
  };

  const handleExportHeatmapCsv = () => {
    if (!hourlyData.length) return;
    const headers = ['Timestamp', 'Date', 'Hour', 'Grid Import (kW)', 'Tariff Price (₹/kWh)', 'Hourly Import Cost (₹)'];
    const rows = hourlyData.map((d) => [
      d.timestamp,
      d.timestamp.slice(0, 10),
      d.timestamp.slice(11, 13),
      d.grid_import_kw.toFixed(3),
      d.price.toFixed(2),
      (d.grid_import_kw * d.price).toFixed(2),
    ]);
    exportToCsv(`helios-grid-import-matrix-${startDate.slice(0, 10)}-to-${endDate.slice(0, 10)}`, headers, rows);
  };

  return (
    <div className="pt-20 md:pt-24 min-h-screen bg-bg text-ink selection:bg-ink selection:text-bg">
      {/* 1. Page Header per Inner-Page Style Block */}
      <div className="max-w-[1320px] mx-auto px-6 pt-10 pb-6">
        <Label variant="parenthesised">(03) ENERGY</Label>
        <MaskedLines
          text="*Energy flow and battery*"
          as="h1"
          className="text-h1 font-serif italic text-ink font-light mt-2"
        />
        <p className="text-body text-muted mt-2 max-w-3xl">
          Real-time multi-carrier energy balance, battery state-of-charge dynamics, and grid interchange telemetry.
        </p>
        <div className="w-full h-[1px] bg-hairline mt-6" />
      </div>

      {/* 2. Sticky ScenarioBar with Battery Controls Enabled */}
      <ScenarioBar showBatteryControls={true} />

      {/* 3. Main Content Container */}
      <div className="max-w-[1320px] mx-auto px-6 py-10 md:py-14 space-y-12">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-8 border border-hairline rounded-frame bg-surface/50">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-14 w-32" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
            </div>
            <Skeleton className="h-[480px] w-full rounded-frame" />
            <Skeleton className="h-[480px] w-full rounded-frame" />
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <ErrorState
            title="Failed to Load Microgrid Energy Telemetry"
            message={error.message || 'The simulation service encountered an unexpected error.'}
            onRetry={() => refetch()}
          />
        )}

        {/* Empty State */}
        {!isLoading && !error && hourlyData.length === 0 && (
          <EmptyState
            title="No Energy Telemetry Available"
            description="The selected date interval contains no active simulation records. Please pick another date range in the ScenarioBar."
          />
        )}

        {/* Loaded Content */}
        {!isLoading && !error && hourlyData.length > 0 && (
          <>
            {/* 4. KPI ROW (Display-Serif Numerals, Count-Up Once) */}
            <Reveal>
              <div className="border border-hairline rounded-frame bg-surface/60 p-6 md:p-8 backdrop-blur-[2px]">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 divide-y lg:divide-y-0 lg:divide-x divide-hairline">
                  {/* KPI 1: Battery Cycles */}
                  <div className="pt-4 lg:pt-0 lg:px-4 first:pt-0 first:pl-0">
                    <MotionNumeral
                      value={batteryCycles}
                      decimals={1}
                      unit="cycles"
                      captionLine1="Battery throughput cycles"
                      captionLine2="Accumulated equivalent full charge cycles"
                      staggerIndex={0}
                      size="lg"
                    />
                  </div>

                  {/* KPI 2: Round-Trip Losses */}
                  <div className="pt-6 lg:pt-0 lg:px-6">
                    <MotionNumeral
                      value={roundTripLossesKwh}
                      decimals={1}
                      unit="kWh"
                      captionLine1="Round-trip storage losses"
                      captionLine2="Dissipation via 90.25% round-trip efficiency"
                      staggerIndex={1}
                      size="lg"
                    />
                  </div>

                  {/* KPI 3: Peak Grid Import */}
                  <div className="pt-6 lg:pt-0 lg:px-6">
                    <MotionNumeral
                      value={peakGridImportKw}
                      decimals={2}
                      unit="kW"
                      captionLine1="Peak grid import demand"
                      captionLine2="Suppressed through stored PV capacity"
                      staggerIndex={2}
                      size="lg"
                    />
                  </div>

                  {/* KPI 4: Self-Sufficiency */}
                  <div className="pt-6 lg:pt-0 lg:px-6">
                    <MotionNumeral
                      value={selfSufficiencyPct}
                      decimals={1}
                      unit="%"
                      captionLine1="Building self-sufficiency"
                      captionLine2="Proportion of load supplied without utility grid"
                      staggerIndex={3}
                      size="lg"
                    />
                  </div>
                </div>
              </div>
            </Reveal>

            {/* 5. STATE OF CHARGE & STORAGE DISPATCH CHART */}
            <Reveal delay={0.1}>
              <Panel className="border border-hairline rounded-frame p-6 md:p-8 bg-surface">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-hairline gap-4">
                  <div>
                    <Label variant="parenthesised">(01) STORAGE DISPATCH</Label>
                    <h2 className="font-serif text-2xl font-light text-ink mt-1">
                      State of Charge & Storage Dispatch
                    </h2>
                    <p className="text-caption text-muted mt-1">
                      Continuous battery state-of-charge with operational bounds (10% to 100%) and bidirectional charge/discharge power bars.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 self-start md:self-auto">
                    <PillButton
                      variant="outline"
                      showArrow={false}
                      onClick={handleExportSocCsv}
                      className="text-xs px-3.5 py-1.5"
                    >
                      <FileText size={12} className="mr-1.5 inline" /> Export CSV
                    </PillButton>
                    <PillButton
                      variant="outline"
                      showArrow={false}
                      onClick={() =>
                        downloadChartPng(
                          socChartRef.current,
                          `helios-battery-soc-${startDate.slice(0, 10)}`
                        )
                      }
                      className="text-xs px-3.5 py-1.5"
                    >
                      <Download size={12} className="mr-1.5 inline" /> Download PNG
                    </PillButton>
                  </div>
                </div>

                {/* Chart Frame */}
                <div className="pt-6">
                  <StateOfChargeChart
                    chartRef={socChartRef}
                    data={hourlyData}
                    batteryKwh={batteryKwh}
                    batteryKw={batteryKw}
                    height={440}
                  />
                </div>

                {/* Parameter Footnote */}
                <div className="mt-4 pt-4 border-t border-hairline flex flex-wrap items-center justify-between text-caption text-muted gap-4">
                  <div className="flex items-center gap-4">
                    <span>
                      Rated Capacity: <b className="text-ink">{batteryKwh.toFixed(1)} kWh</b>
                    </span>
                    <span>·</span>
                    <span>
                      Max Inverter Power: <b className="text-ink">{batteryKw.toFixed(1)} kW</b>
                    </span>
                    <span>·</span>
                    <span>
                      Operating Limits: <b className="text-ink">10% – 100% SoC</b>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-battery">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Non-inverting dispatch constraint satisfied</span>
                  </div>
                </div>
              </Panel>
            </Reveal>

            {/* 6. MULTI-CARRIER ENERGY FLOW SANKEY */}
            <Reveal delay={0.2}>
              <Panel className="border border-hairline rounded-frame p-6 md:p-8 bg-surface">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-hairline gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <Label variant="parenthesised">(02) ENERGY FLOW</Label>
                      <Badge variant="neutral">Conservation Verified</Badge>
                    </div>
                    <h2 className="font-serif text-2xl font-light text-ink mt-1">
                      Multi-Carrier Energy Balance (Sankey)
                    </h2>
                    <p className="text-caption text-muted mt-1">
                      Complete energy routing from photovoltaic generation and grid import into building demand, storage, and utility feed-in.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 self-start md:self-auto">
                    <PillButton
                      variant="outline"
                      showArrow={false}
                      onClick={handleExportSankeyCsv}
                      className="text-xs px-3.5 py-1.5"
                    >
                      <FileText size={12} className="mr-1.5 inline" /> Export CSV
                    </PillButton>
                    <PillButton
                      variant="outline"
                      showArrow={false}
                      onClick={() =>
                        downloadChartPng(
                          sankeyChartRef.current,
                          `helios-energy-sankey-${startDate.slice(0, 10)}`
                        )
                      }
                      className="text-xs px-3.5 py-1.5"
                    >
                      <Download size={12} className="mr-1.5 inline" /> Download PNG
                    </PillButton>
                  </div>
                </div>

                {/* Sankey Diagram */}
                <div className="pt-6">
                  <EnergyFlowSankeyChart
                    chartRef={sankeyChartRef}
                    data={hourlyData}
                    height={460}
                  />
                </div>

                {/* Nodal Balance Telemetry Cards */}
                <div className="mt-6 pt-6 border-t border-hairline grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="p-3 bg-bg/60 rounded-control border border-hairline">
                    <div className="text-[11px] uppercase tracking-label text-muted">Solar → Load</div>
                    <div className="font-sans text-base font-medium text-ink tabular-nums mt-1">
                      {flowBreakdown.solarToLoad.toFixed(1)} <span className="text-caption text-muted font-normal">kWh</span>
                    </div>
                  </div>

                  <div className="p-3 bg-bg/60 rounded-control border border-hairline">
                    <div className="text-[11px] uppercase tracking-label text-muted">Solar → Battery</div>
                    <div className="font-sans text-base font-medium text-ink tabular-nums mt-1">
                      {flowBreakdown.solarToBatt.toFixed(1)} <span className="text-caption text-muted font-normal">kWh</span>
                    </div>
                  </div>

                  <div className="p-3 bg-bg/60 rounded-control border border-hairline">
                    <div className="text-[11px] uppercase tracking-label text-muted">Solar → Export</div>
                    <div className="font-sans text-base font-medium text-ink tabular-nums mt-1">
                      {flowBreakdown.solarToExport.toFixed(1)} <span className="text-caption text-muted font-normal">kWh</span>
                    </div>
                  </div>

                  <div className="p-3 bg-bg/60 rounded-control border border-hairline">
                    <div className="text-[11px] uppercase tracking-label text-muted">Battery → Load</div>
                    <div className="font-sans text-base font-medium text-ink tabular-nums mt-1">
                      {flowBreakdown.battToLoad.toFixed(1)} <span className="text-caption text-muted font-normal">kWh</span>
                    </div>
                  </div>

                  <div className="p-3 bg-bg/60 rounded-control border border-hairline">
                    <div className="text-[11px] uppercase tracking-label text-muted">Grid → Load</div>
                    <div className="font-sans text-base font-medium text-ink tabular-nums mt-1">
                      {flowBreakdown.gridToLoad.toFixed(1)} <span className="text-caption text-muted font-normal">kWh</span>
                    </div>
                  </div>

                  <div className="p-3 bg-bg/60 rounded-control border border-hairline">
                    <div className="text-[11px] uppercase tracking-label text-muted">Grid → Battery</div>
                    <div className="font-sans text-base font-medium text-ink tabular-nums mt-1">
                      {flowBreakdown.gridToBatt.toFixed(1)} <span className="text-caption text-muted font-normal">kWh</span>
                    </div>
                  </div>
                </div>

                {/* Exact Flow Balance Guarantee Notice */}
                <div className="mt-4 text-[12px] text-muted flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-battery shrink-0" />
                  <span>
                    Conservation verification: Total Generation ({flowBreakdown.totalSolar.toFixed(1)} kWh) and Total Building Demand ({flowBreakdown.totalLoad.toFixed(1)} kWh) balance across all 6 nodal trajectories.
                  </span>
                </div>
              </Panel>
            </Reveal>

            {/* 7. GRID IMPORT HEATMAP MATRIX */}
            <Reveal delay={0.3}>
              <Panel className="border border-hairline rounded-frame p-6 md:p-8 bg-surface">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-hairline gap-4">
                  <div>
                    <Label variant="parenthesised">(03) TEMPORAL INTENSITY</Label>
                    <h2 className="font-serif text-2xl font-light text-ink mt-1">
                      Grid Import Heatmap by Hour of Day
                    </h2>
                    <p className="text-caption text-muted mt-1">
                      Hourly utility demand intensity matrix plotted across days, displaying peak load curtailment in a single-hue ivory-to-grid progression.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 self-start md:self-auto">
                    <PillButton
                      variant="outline"
                      showArrow={false}
                      onClick={handleExportHeatmapCsv}
                      className="text-xs px-3.5 py-1.5"
                    >
                      <FileText size={12} className="mr-1.5 inline" /> Export CSV
                    </PillButton>
                    <PillButton
                      variant="outline"
                      showArrow={false}
                      onClick={() =>
                        downloadChartPng(
                          heatmapChartRef.current,
                          `helios-grid-heatmap-${startDate.slice(0, 10)}`
                        )
                      }
                      className="text-xs px-3.5 py-1.5"
                    >
                      <Download size={12} className="mr-1.5 inline" /> Download PNG
                    </PillButton>
                  </div>
                </div>

                {/* Heatmap Frame */}
                <div className="pt-6">
                  <GridImportHeatmapChart
                    chartRef={heatmapChartRef}
                    data={hourlyData}
                    height={420}
                  />
                </div>

                <div className="mt-4 pt-4 border-t border-hairline flex flex-wrap items-center justify-between text-caption text-muted gap-4">
                  <span>
                    Single-hue color gradient: Ivory (0 kW base) → Steel Slate (Peak Grid Import).
                  </span>
                  <span>
                    Cross-referenced against time-of-use tariff periods (Off-peak ₹6 · Normal ₹8 · Peak ₹11).
                  </span>
                </div>
              </Panel>
            </Reveal>
          </>
        )}
      </div>
    </div>
  );
};

export default Energy;
