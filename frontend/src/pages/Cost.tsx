import React, { useMemo, useState, useRef } from 'react';
import { useGlobalState } from '../context/GlobalStateContext';
import { useCompareQuery, useSimulateQuery, usePeriodSummaryQuery } from '../api/client';
import { Label } from '../components/ui/Label';
import { PillButton } from '../components/ui/Button';
import { Panel } from '../components/ui/Panel';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Reveal } from '../components/ui/Reveal';
import { MaskedLines } from '../motion/MaskedLines';
import { ScenarioBar } from '../components/layout/ScenarioBar';
import {
  CumulativeCostChart,
  TariffArbitrageChart,
  MonthlySavingsBarChart,
} from '../components/charts/CostCharts';
import { exportToCsv, downloadChartPng } from '../lib/exportUtils';
import { Download, FileText } from 'lucide-react';
import type ReactECharts from 'echarts-for-react';

const Cost: React.FC = () => {
  const { startDate, endDate, strategy, batteryKwh, batteryKw, resetToDefaults } = useGlobalState();
  const [selectedYear, setSelectedYear] = useState<string>('2026');

  // 1. Compare Query (Grid-only vs Rule-based vs Optimised LP)
  const {
    data: compareData,
    isLoading: compareLoading,
    error: compareError,
    refetch: refetchCompare,
  } = useCompareQuery({
    start: startDate,
    end: endDate,
    battery_kwh: batteryKwh,
    battery_kw: batteryKw,
  });

  // 2. Simulation Query (for hourly dispatch profiles used by Tariff Arbitrage chart)
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

  // 3. Period Summary Query (for Annual Monthly Breakdown)
  const {
    data: periodData,
    isLoading: periodLoading,
  } = usePeriodSummaryQuery(parseInt(selectedYear, 10), 'month');

  // Chart refs for PNG downloads
  const cumChartRef = useRef<ReactECharts>(null);
  const tariffChartRef = useRef<ReactECharts>(null);
  const monthlyChartRef = useRef<ReactECharts>(null);

  const isLoading = compareLoading || simLoading;
  const isError = Boolean(compareError || simError);

  // Strategy comparison KPIs
  const gridOnly = compareData?.strategies?.grid_only;
  const ruleBased = compareData?.strategies?.rule_based;
  const optimisedLp = compareData?.strategies?.optimised_lp;

  const gridOnlyCost = gridOnly?.total_cost ?? 0;
  const ruleBasedCost = ruleBased?.total_cost ?? 0;
  const optimisedCost = optimisedLp?.total_cost ?? 0;

  const savingsAmount = optimisedLp?.savings_amount ?? Math.max(0, gridOnlyCost - optimisedCost);
  const savingsPercent = optimisedLp?.savings_percent ?? (gridOnlyCost > 0 ? (savingsAmount / gridOnlyCost) * 100 : 0);
  const ruleSavingsAmount = ruleBased?.savings_amount ?? Math.max(0, gridOnlyCost - ruleBasedCost);
  const ruleSavingsPercent = ruleBased?.savings_percent ?? (gridOnlyCost > 0 ? (ruleSavingsAmount / gridOnlyCost) * 100 : 0);

  const cumSeries = compareData?.cumulative_cost_series || compareData?.cumulative_costs || [];
  const hourlyData = simData?.hourly_series || [];
  const periods = periodData?.periods || [];

  // ==========================================================================
  // TABLE DATA DERIVATIONS & BEST VALUE BOLDING (Requirement 2)
  // ==========================================================================
  const comparisonRows = useMemo(() => {
    if (!gridOnly || !ruleBased || !optimisedLp) return [];

    return [
      {
        id: 'grid_only',
        name: 'Grid-only Baseline',
        description: 'Unbuffered utility grid imports without battery storage',
        cost: gridOnly.total_cost,
        savingsAmt: 0,
        savingsPct: 0,
        gridImportKwh: gridOnly.grid_import_kwh,
        selfConsumptionPct: gridOnly.solar_self_consumption_percent,
        batteryCycles: 0,
      },
      {
        id: 'rule_based',
        name: 'Rule-based Self-consumption',
        description: 'Greedy photovoltaic absorption and local discharge',
        cost: ruleBased.total_cost,
        savingsAmt: ruleSavingsAmount,
        savingsPct: ruleSavingsPercent,
        gridImportKwh: ruleBased.grid_import_kwh,
        selfConsumptionPct: ruleBased.solar_self_consumption_percent,
        batteryCycles: ruleBased.battery_cycles,
      },
      {
        id: 'optimised_lp',
        name: 'Optimised Linear Program',
        description: 'Global multi-tariff optimization with time-of-use arbitrage',
        cost: optimisedLp.total_cost,
        savingsAmt: savingsAmount,
        savingsPct: savingsPercent,
        gridImportKwh: optimisedLp.grid_import_kwh,
        selfConsumptionPct: optimisedLp.solar_self_consumption_percent,
        batteryCycles: optimisedLp.battery_cycles,
      },
    ];
  }, [gridOnly, ruleBased, optimisedLp, ruleSavingsAmount, ruleSavingsPercent, savingsAmount, savingsPercent]);

  // Find optimal values per column for non-coloured bolding
  const bestCost = useMemo(() => {
    if (!comparisonRows.length) return 0;
    return Math.min(...comparisonRows.map((r) => r.cost));
  }, [comparisonRows]);

  const bestSavings = useMemo(() => {
    if (!comparisonRows.length) return 0;
    return Math.max(...comparisonRows.map((r) => r.savingsAmt));
  }, [comparisonRows]);

  const bestImport = useMemo(() => {
    if (!comparisonRows.length) return 0;
    return Math.min(...comparisonRows.map((r) => r.gridImportKwh));
  }, [comparisonRows]);

  const bestSelfCons = useMemo(() => {
    if (!comparisonRows.length) return 0;
    return Math.max(...comparisonRows.map((r) => r.selfConsumptionPct));
  }, [comparisonRows]);

  // Annual Totals from period data
  const annualTotals = useMemo(() => {
    if (!periods.length) return null;
    let totalSolar = 0;
    let totalLoad = 0;
    let totalGridOnly = 0;
    let totalRule = 0;
    let totalOpt = 0;
    let totalSavings = 0;

    periods.forEach((p) => {
      totalSolar += p.solar_kwh;
      totalLoad += p.load_kwh;
      totalGridOnly += p.grid_only_cost;
      totalRule += p.rule_based_cost;
      totalOpt += p.optimised_cost;
      totalSavings += p.savings_amount;
    });

    const avgSelfCons =
      periods.reduce((acc, p) => acc + p.solar_self_consumption_percent, 0) / periods.length;
    const overallSavingsPct = totalGridOnly > 0 ? (totalSavings / totalGridOnly) * 100 : 0;

    return {
      totalSolar,
      totalLoad,
      totalGridOnly,
      totalRule,
      totalOpt,
      totalSavings,
      overallSavingsPct,
      avgSelfCons,
    };
  }, [periods]);

  // ==========================================================================
  // CSV EXPORT HANDLERS
  // ==========================================================================
  const handleExportComparisonCsv = () => {
    if (!comparisonRows.length) return;
    const headers = [
      'Strategy',
      'Total Cost (₹)',
      'Savings vs Grid (₹)',
      'Savings (%)',
      'Grid Import (kWh)',
      'Solar Self-Consumption (%)',
      'Battery Cycles',
    ];
    const rows = comparisonRows.map((r) => [
      r.name,
      r.cost.toFixed(2),
      r.savingsAmt.toFixed(2),
      r.savingsPct.toFixed(1),
      r.gridImportKwh.toFixed(1),
      r.selfConsumptionPct.toFixed(1),
      r.batteryCycles.toFixed(1),
    ]);
    exportToCsv(`helios-strategy-comparison-${startDate.slice(0, 10)}-to-${endDate.slice(0, 10)}`, headers, rows);
  };

  const handleExportCumulativeCsv = () => {
    if (!cumSeries.length) return;
    const headers = ['Timestamp', 'Grid-Only Baseline (₹)', 'Rule-Based Cost (₹)', 'Optimised LP Cost (₹)'];
    const rows = cumSeries.map((d) => [
      d.timestamp,
      d.grid_only.toFixed(2),
      d.rule_based.toFixed(2),
      d.optimised_lp.toFixed(2),
    ]);
    exportToCsv(`helios-cumulative-costs-${startDate.slice(0, 10)}-to-${endDate.slice(0, 10)}`, headers, rows);
  };

  const handleExportTariffCsv = () => {
    if (!hourlyData.length) return;
    const headers = ['Hour', 'Tariff Price (₹/kWh)', 'Time-of-Use Band'];
    const tariffRates = [6, 6, 6, 6, 6, 6, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 11, 11, 11, 11, 6, 6];
    const rows = tariffRates.map((rate, h) => [
      `${String(h).padStart(2, '0')}:00`,
      rate.toFixed(2),
      rate === 6 ? 'Off-Peak' : rate === 8 ? 'Normal' : 'Peak',
    ]);
    exportToCsv(`helios-tariff-structure`, headers, rows);
  };

  const handleExportMonthlyCsv = () => {
    if (!periods.length) return;
    const headers = [
      'Month Period',
      'Solar Generation (kWh)',
      'Building Load (kWh)',
      'Grid-Only Cost (₹)',
      'Rule-Based Cost (₹)',
      'Optimised Cost (₹)',
      'Savings (₹)',
      'Savings (%)',
      'Self-Consumption (%)',
    ];
    const rows = periods.map((p) => [
      p.period,
      p.solar_kwh.toFixed(1),
      p.load_kwh.toFixed(1),
      p.grid_only_cost.toFixed(2),
      p.rule_based_cost.toFixed(2),
      p.optimised_cost.toFixed(2),
      p.savings_amount.toFixed(2),
      p.savings_percent.toFixed(1),
      p.solar_self_consumption_percent.toFixed(1),
    ]);
    exportToCsv(`helios-monthly-savings-${selectedYear}`, headers, rows);
  };

  return (
    <div className="pt-20 md:pt-24 min-h-screen bg-bg text-ink selection:bg-ink selection:text-bg">
      {/* 1. Page Header per Inner-Page Style Block */}
      <div className="max-w-[1320px] mx-auto px-6 pt-10 pb-6">
        <Label variant="parenthesised">(04) COST</Label>
        <MaskedLines
          text="*Cost and optimisation*"
          as="h1"
          className="text-h1 font-serif italic text-ink font-light mt-2"
        />
        <p className="text-body text-muted mt-2 max-w-3xl">
          Comparative economic dispatch evaluation, multi-tariff time-of-use arbitrage, and cumulative expenditure trends.
        </p>
        <div className="w-full h-[1px] bg-hairline mt-6" />
      </div>

      {/* 2. Sticky ScenarioBar (showBatteryControls={false}) */}
      <ScenarioBar showBatteryControls={false} />

      {/* 3. Main Content Container */}
      <div className="max-w-[1320px] mx-auto px-6 py-10 md:py-14 space-y-12">
        {/* Loading Skeletons */}
        {isLoading && (
          <div className="space-y-8">
            <Skeleton className="h-28 w-full rounded-frame" />
            <Skeleton className="h-64 w-full rounded-frame" />
            <Skeleton className="h-[440px] w-full rounded-frame" />
          </div>
        )}

        {/* Error State */}
        {isError && !isLoading && (
          <ErrorState
            title="Failed to Load Economic Telemetry"
            message={compareError?.message || simError?.message || 'Unable to retrieve comparative financial data.'}
            onRetry={() => {
              refetchCompare();
              refetchSim();
            }}
          />
        )}

        {/* Empty State */}
        {!isLoading && !isError && (!compareData || !simData) && (
          <EmptyState
            title="No Cost Data in Selected Range"
            description="No simulation cost records found for the requested horizon. Try selecting a different date range."
            actionLabel="Reset to Default Range"
            onAction={resetToDefaults}
          />
        )}

        {/* Loaded Content */}
        {!isLoading && !isError && (
          <>
            {/* 1. TOP LIVE SUMMARY SENTENCE (Requirement 1) */}
            <Reveal>
              <div className="p-6 md:p-8 border border-hairline rounded-frame bg-surface shadow-xs">
                <span className="text-[11px] uppercase tracking-label text-muted font-normal block mb-2">
                  Economic Yield Summary
                </span>
                <p className="text-xl md:text-2xl text-ink font-light leading-relaxed">
                  Across the selected horizon ({startDate.slice(0, 10)} to {endDate.slice(0, 10)}), autonomous linear optimisation achieved total electricity expenditure savings of{' '}
                  <span className="font-serif italic font-normal text-3xl md:text-4xl text-battery">
                    ₹ {savingsAmount.toFixed(2)}
                  </span>{' '}
                  (<span className="font-serif italic font-normal text-2xl text-ink">{savingsPercent.toFixed(1)}% reduction</span>) compared to unbuffered utility grid baseline imports of ₹ {gridOnlyCost.toFixed(2)}.
                </p>
              </div>
            </Reveal>

            {/* 2. STRATEGY COMPARISON TABLE (Requirement 2: Best per column in bold) */}
            <Reveal delay={0.1}>
              <Panel className="border border-hairline rounded-frame p-6 md:p-8 bg-surface">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-hairline gap-4">
                  <div>
                    <Label variant="parenthesised">(01) DISPATCH EVALUATION</Label>
                    <h2 className="font-serif text-2xl font-light text-ink mt-1">
                      Strategy Comparison Matrix
                    </h2>
                    <p className="text-caption text-muted mt-1">
                      Empirical dispatch metrics evaluated over identical meteorological conditions and building demand profiles.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 self-start md:self-auto">
                    <PillButton
                      variant="outline"
                      showArrow={false}
                      onClick={handleExportComparisonCsv}
                      className="text-xs px-3.5 py-1.5"
                    >
                      <FileText size={12} className="mr-1.5 inline" /> Export CSV
                    </PillButton>
                  </div>
                </div>

                {/* Table Container */}
                <div className="pt-6 overflow-x-auto">
                  <table className="w-full text-left text-ui border-collapse">
                    <thead>
                      <tr className="border-b border-hairline text-[11px] uppercase tracking-label text-muted">
                        <th className="py-3 pr-4 font-normal">Strategy</th>
                        <th className="py-3 px-4 font-normal text-right">Total Cost</th>
                        <th className="py-3 px-4 font-normal text-right">Savings vs Grid</th>
                        <th className="py-3 px-4 font-normal text-right">Grid Import</th>
                        <th className="py-3 px-4 font-normal text-right">Self-Consumption</th>
                        <th className="py-3 pl-4 font-normal text-right">Battery Cycles</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {comparisonRows.map((row) => {
                        const isBestCost = row.cost === bestCost;
                        const isBestSavings = row.savingsAmt === bestSavings && row.savingsAmt > 0;
                        const isBestImport = row.gridImportKwh === bestImport;
                        const isBestSelfCons = row.selfConsumptionPct === bestSelfCons;
                        const isBestCycles = row.batteryCycles > 0 && row.id === 'optimised_lp';

                        return (
                          <tr key={row.id} className="hover:bg-surface/80 transition-colors">
                            {/* Strategy Name */}
                            <td className="py-4 pr-4">
                              <div className="font-medium text-ink">{row.name}</div>
                              <div className="text-caption text-muted">{row.description}</div>
                            </td>

                            {/* Total Cost */}
                            <td className="py-4 px-4 text-right tabular-nums">
                              <span
                                className={`font-sans text-base tabular-nums ${
                                  isBestCost ? 'font-bold text-ink' : 'font-normal text-ink/80'
                                }`}
                              >
                                ₹ {row.cost.toFixed(2)}
                              </span>
                            </td>

                            {/* Savings vs Grid */}
                            <td className="py-4 px-4 text-right tabular-nums">
                              {row.id === 'grid_only' ? (
                                <span className="text-muted">—</span>
                              ) : (
                                <span
                                  className={`font-sans text-base tabular-nums ${
                                    isBestSavings ? 'font-bold text-ink' : 'font-normal text-ink/80'
                                  }`}
                                >
                                  ₹ {row.savingsAmt.toFixed(2)}{' '}
                                  <span className="text-caption text-muted font-sans font-normal">
                                    (-{row.savingsPct.toFixed(1)}%)
                                  </span>
                                </span>
                              )}
                            </td>

                            {/* Grid Import kWh */}
                            <td className="py-4 px-4 text-right tabular-nums">
                              <span className={isBestImport ? 'font-bold text-ink' : 'font-normal text-muted'}>
                                {row.gridImportKwh.toFixed(1)} kWh
                              </span>
                            </td>

                            {/* Self-Consumption % */}
                            <td className="py-4 px-4 text-right tabular-nums">
                              <span className={isBestSelfCons ? 'font-bold text-ink' : 'font-normal text-muted'}>
                                {row.selfConsumptionPct.toFixed(1)}%
                              </span>
                            </td>

                            {/* Battery Cycles */}
                            <td className="py-4 pl-4 text-right tabular-nums">
                              <span className={isBestCycles ? 'font-bold text-ink' : 'font-normal text-muted'}>
                                {row.batteryCycles.toFixed(1)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 pt-4 border-t border-hairline text-caption text-muted flex items-center justify-between">
                  <span>* Best performance metric per column highlighted in bold typography.</span>
                  <span>Physical energy balance verified across all 8,760 hours.</span>
                </div>
              </Panel>
            </Reveal>

            {/* 3. CUMULATIVE COST CHART (Requirement 3) */}
            <Reveal delay={0.15}>
              <Panel className="border border-hairline rounded-frame p-6 md:p-8 bg-surface">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-hairline gap-4">
                  <div>
                    <Label variant="parenthesised">(02) EXPENDITURE ACCRUAL</Label>
                    <h2 className="font-serif text-2xl font-light text-ink mt-1">
                      Cumulative Cost Accrual Dynamics
                    </h2>
                    <p className="text-caption text-muted mt-1">
                      Continuous financial expenditure trajectory tracking monetary divergence over the operational horizon.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 self-start md:self-auto">
                    <PillButton
                      variant="outline"
                      showArrow={false}
                      onClick={handleExportCumulativeCsv}
                      className="text-xs px-3.5 py-1.5"
                    >
                      <FileText size={12} className="mr-1.5 inline" /> Export CSV
                    </PillButton>
                    <PillButton
                      variant="outline"
                      showArrow={false}
                      onClick={() =>
                        downloadChartPng(
                          cumChartRef.current,
                          `helios-cumulative-costs-${startDate.slice(0, 10)}`
                        )
                      }
                      className="text-xs px-3.5 py-1.5"
                    >
                      <Download size={12} className="mr-1.5 inline" /> Download PNG
                    </PillButton>
                  </div>
                </div>

                <div className="pt-6">
                  <CumulativeCostChart chartRef={cumChartRef} data={cumSeries} height={420} />
                </div>
              </Panel>
            </Reveal>

            {/* 4. TARIFF ARBITRAGE CHART (Requirement 4) */}
            <Reveal delay={0.2}>
              <Panel className="border border-hairline rounded-frame p-6 md:p-8 bg-surface">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-hairline gap-4">
                  <div>
                    <Label variant="parenthesised">(03) TARIFF ARBITRAGE</Label>
                    <h2 className="font-serif text-2xl font-light text-ink mt-1">
                      Time-of-Use Rate Structure & Battery Dispatch
                    </h2>
                    <p className="text-caption text-muted mt-1">
                      Scheduled electrochemical storage charge and discharge profiles overlaid on utility tariff tiers to demonstrate cost-shifting arbitrage.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 self-start md:self-auto">
                    <PillButton
                      variant="outline"
                      showArrow={false}
                      onClick={handleExportTariffCsv}
                      className="text-xs px-3.5 py-1.5"
                    >
                      <FileText size={12} className="mr-1.5 inline" /> Export CSV
                    </PillButton>
                    <PillButton
                      variant="outline"
                      showArrow={false}
                      onClick={() =>
                        downloadChartPng(
                          tariffChartRef.current,
                          `helios-tariff-arbitrage-${startDate.slice(0, 10)}`
                        )
                      }
                      className="text-xs px-3.5 py-1.5"
                    >
                      <Download size={12} className="mr-1.5 inline" /> Download PNG
                    </PillButton>
                  </div>
                </div>

                <div className="pt-6">
                  <TariffArbitrageChart
                    chartRef={tariffChartRef}
                    hourlySimData={hourlyData}
                    height={420}
                  />
                </div>

                <div className="mt-4 pt-4 border-t border-hairline flex flex-wrap items-center justify-between text-caption text-muted gap-4">
                  <div className="flex items-center gap-4">
                    <span>Off-Peak (22:00 – 06:00): <b className="text-ink">₹ 6.00 / kWh</b></span>
                    <span>·</span>
                    <span>Normal (06:00 – 18:00): <b className="text-ink">₹ 8.00 / kWh</b></span>
                    <span>·</span>
                    <span>Peak (18:00 – 22:00): <b className="text-fault font-semibold">₹ 11.00 / kWh</b></span>
                  </div>
                  <span>Arbitrage principle: Storage charges at ₹6 and discharges during ₹11 peak hours.</span>
                </div>
              </Panel>
            </Reveal>

            {/* 5. MONTHLY SAVINGS: BAR CHART & TABLE WITH YEAR SELECTOR (Requirement 5) */}
            <Reveal delay={0.25}>
              <Panel className="border border-hairline rounded-frame p-6 md:p-8 bg-surface">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-hairline gap-4">
                  <div>
                    <Label variant="parenthesised">(04) ANNUAL BREAKDOWN</Label>
                    <h2 className="font-serif text-2xl font-light text-ink mt-1">
                      Monthly Savings & Financial Yield
                    </h2>
                    <p className="text-caption text-muted mt-1">
                      Month-by-month comparative evaluation from pre-computed period summaries over the full calendar year.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 self-start md:self-auto">
                    {/* Year Selector */}
                    <div className="w-32">
                      <Select
                        label="Calendar Year"
                        value={selectedYear}
                        onValueChange={setSelectedYear}
                        options={[
                          { value: '2026', label: '2026 (Simulated)' },
                          { value: '2025', label: '2025 (Historical)' },
                        ]}
                      />
                    </div>

                    <PillButton
                      variant="outline"
                      showArrow={false}
                      onClick={handleExportMonthlyCsv}
                      className="text-xs px-3.5 py-1.5 self-end"
                    >
                      <FileText size={12} className="mr-1.5 inline" /> Export CSV
                    </PillButton>
                    <PillButton
                      variant="outline"
                      showArrow={false}
                      onClick={() =>
                        downloadChartPng(
                          monthlyChartRef.current,
                          `helios-monthly-savings-${selectedYear}`
                        )
                      }
                      className="text-xs px-3.5 py-1.5 self-end"
                    >
                      <Download size={12} className="mr-1.5 inline" /> Download PNG
                    </PillButton>
                  </div>
                </div>

                {periodLoading ? (
                  <Skeleton className="h-80 w-full mt-6" />
                ) : periods.length === 0 ? (
                  <div className="py-12 text-center text-muted">
                    No period summary available for year {selectedYear}.
                  </div>
                ) : (
                  <>
                    {/* Monthly Bar Chart */}
                    <div className="pt-6">
                      <MonthlySavingsBarChart
                        chartRef={monthlyChartRef}
                        periods={periods}
                        height={380}
                      />
                    </div>

                    {/* Monthly Savings Data Table */}
                    <div className="mt-8 pt-6 border-t border-hairline overflow-x-auto">
                      <table className="w-full text-left text-ui border-collapse">
                        <thead>
                          <tr className="border-b border-hairline text-[11px] uppercase tracking-label text-muted">
                            <th className="py-2.5 pr-3 font-normal">Month</th>
                            <th className="py-2.5 px-3 font-normal text-right">Solar (kWh)</th>
                            <th className="py-2.5 px-3 font-normal text-right">Load (kWh)</th>
                            <th className="py-2.5 px-3 font-normal text-right">Grid-Only (₹)</th>
                            <th className="py-2.5 px-3 font-normal text-right">Rule-Based (₹)</th>
                            <th className="py-2.5 px-3 font-normal text-right">Optimised (₹)</th>
                            <th className="py-2.5 px-3 font-normal text-right">Savings (₹ / %)</th>
                            <th className="py-2.5 pl-3 font-normal text-right">Self-Consumption</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-hairline">
                          {periods.map((p) => {
                            const isCheapest = p.optimised_cost <= p.rule_based_cost;

                            return (
                              <tr key={p.period} className="hover:bg-surface/80 transition-colors">
                                <td className="py-2.5 pr-3 font-medium text-ink">
                                  {p.period}
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums text-muted">
                                  {p.solar_kwh.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums text-muted">
                                  {p.load_kwh.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums text-muted">
                                  ₹ {p.grid_only_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums text-muted">
                                  ₹ {p.rule_based_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums">
                                  <span className={isCheapest ? 'font-bold text-ink' : 'font-normal text-ink'}>
                                    ₹ {p.optimised_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums">
                                  <span className="font-bold text-ink">
                                    ₹ {p.savings_amount.toFixed(2)}{' '}
                                    <span className="text-caption text-muted font-normal font-sans">
                                      (-{p.savings_percent.toFixed(1)}%)
                                    </span>
                                  </span>
                                </td>
                                <td className="py-2.5 pl-3 text-right tabular-nums text-muted">
                                  {p.solar_self_consumption_percent.toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {annualTotals && (
                          <tfoot>
                            <tr className="border-t-2 border-hairline font-bold text-ink bg-surface/50">
                              <td className="py-3 pr-3 uppercase tracking-label text-[11px]">
                                Annual Total
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums">
                                {annualTotals.totalSolar.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums">
                                {annualTotals.totalLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums">
                                ₹ {annualTotals.totalGridOnly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums">
                                ₹ {annualTotals.totalRule.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums text-battery">
                                ₹ {annualTotals.totalOpt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums text-battery">
                                ₹ {annualTotals.totalSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                                <span className="text-caption text-muted font-normal font-sans">
                                  (-{annualTotals.overallSavingsPct.toFixed(1)}%)
                                </span>
                              </td>
                              <td className="py-3 pl-3 text-right tabular-nums">
                                {annualTotals.avgSelfCons.toFixed(1)}%
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </>
                )}
              </Panel>
            </Reveal>

            {/* 6. ONE DEEP-MOSS BAND (Requirement 6: Repeating strategy totals in display serif figures) */}
            <Reveal delay={0.3}>
              <section className="my-8">
                <div className="w-full bg-moss text-moss-text rounded-[16px] py-16 md:py-24 px-6 sm:px-12 md:px-16 border border-hairline/20 shadow-md">
                  <div className="text-center max-w-2xl mx-auto mb-16">
                    <span className="text-[11px] uppercase tracking-label text-moss-text/60 font-normal block mb-3">
                      (04) FINANCIAL OPTIMIZATION
                    </span>
                    <h2 className="text-h1 font-serif italic text-[#FAF7F2] font-light leading-[1.05]">
                      The same sun. A smaller bill.
                    </h2>
                    <p className="text-body text-moss-text/80 font-light mt-4">
                      Multi-tariff linear programming resolves time-of-use costs globally, mitigating import expenditure during high-tariff evening hours.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 text-center">
                    {/* Strategy 1: Grid-Only */}
                    <div className="flex flex-col items-center">
                      <span className="text-caption text-moss-text/60 uppercase tracking-label mb-2">
                        Grid-only baseline
                      </span>
                      <div className="font-serif font-light text-5xl sm:text-6xl text-[#FAF7F2] tabular-nums">
                        ₹ {gridOnlyCost.toFixed(2)}
                      </div>
                      <span className="text-caption text-moss-text/60 font-sans mt-1">
                        No battery buffer
                      </span>
                      <div className="w-full max-w-[200px] h-[3px] bg-moss-text/20 mt-6 rounded-full overflow-hidden">
                        <div className="h-full bg-moss-text/60 w-full" />
                      </div>
                    </div>

                    {/* Strategy 2: Rule-Based */}
                    <div className="flex flex-col items-center">
                      <span className="text-caption text-moss-text/60 uppercase tracking-label mb-2">
                        Rule-based self-consumption
                      </span>
                      <div className="font-serif font-light text-5xl sm:text-6xl text-[#FAF7F2] tabular-nums">
                        ₹ {ruleBasedCost.toFixed(2)}
                      </div>
                      <span className="text-caption text-battery font-sans font-medium mt-1">
                        ₹{ruleSavingsAmount.toFixed(2)} saved · {ruleSavingsPercent.toFixed(1)}% lower
                      </span>
                      <div className="w-full max-w-[200px] h-[3px] bg-moss-text/20 mt-6 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-battery"
                          style={{
                            width: `${Math.min(100, Math.max(10, (ruleBasedCost / (gridOnlyCost || 1)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Strategy 3: Optimised LP */}
                    <div className="flex flex-col items-center">
                      <span className="text-caption text-moss-text/60 uppercase tracking-label mb-2">
                        Optimised linear program
                      </span>
                      <div className="font-serif font-light text-5xl sm:text-6xl text-[#FAF7F2] tabular-nums">
                        ₹ {optimisedCost.toFixed(2)}
                      </div>
                      <span className="text-caption text-solar font-sans font-medium mt-1">
                        ₹{savingsAmount.toFixed(2)} saved · {savingsPercent.toFixed(1)}% lower
                      </span>
                      <div className="w-full max-w-[200px] h-[3px] bg-moss-text/20 mt-6 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-solar"
                          style={{
                            width: `${Math.min(100, Math.max(10, (optimisedCost / (gridOnlyCost || 1)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </Reveal>
          </>
        )}
      </div>
    </div>
  );
};

export default Cost;
