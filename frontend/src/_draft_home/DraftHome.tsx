import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BRAND_NAME } from '../brand';
import { useGlobalState } from '../context/GlobalStateContext';
import {
  useMetaQuery,
  useSimulateQuery,
  useCompareQuery,
  useFaultsQuery,
  useModelPerformanceQuery,
} from '../api/client';
import { DisplayNumber } from '../components/ui/DisplayNumber';
import { CountUp } from '../components/ui/CountUp';
import { PillButton, TextLink } from '../components/ui/Button';
import { Label } from '../components/ui/Label';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import {
  ShowcaseForecastChart,
  ShowcaseFaultChart,
  ShowcaseCostChart,
  BatterySocChart,
} from '../components/charts/HomeCharts';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { window: timeWindow, strategy, batteryKwh, batteryKw } = useGlobalState();
  const [activeModule, setActiveModule] = useState<number>(0);

  // 1. Fetch metadata
  const { data: meta, isLoading: metaLoading, error: metaError, refetch: refetchMeta } = useMetaQuery();

  // 2. Compute date horizon from nav toggle (default Week ending at max_timestamp)
  const { startDate, endDate } = useMemo(() => {
    const maxTs = meta?.max_timestamp || '2026-12-31 23:00:00';
    const maxDate = new Date(maxTs.replace(' ', 'T'));

    const start = new Date(maxDate);
    if (timeWindow === 'day') {
      start.setHours(0, 0, 0, 0);
    } else if (timeWindow === 'week') {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else {
      // month
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    }

    const fmt = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
    };

    return {
      startDate: fmt(start),
      endDate: maxTs,
    };
  }, [meta, timeWindow]);

  // 3. API queries
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
    data: compareData,
    isLoading: compLoading,
    error: compError,
    refetch: refetchCompare,
  } = useCompareQuery({
    start: startDate,
    end: endDate,
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

  const {
    data: perfData,
    isLoading: perfLoading,
    error: perfError,
    refetch: refetchPerf,
  } = useModelPerformanceQuery();

  // Extract key metrics safely
  const savingsPercent = compareData?.strategies?.optimised_lp?.savings_percent ?? 30.7;
  const selfConsumptionPercent = compareData?.strategies?.optimised_lp?.solar_self_consumption_percent ?? 82.9;
  const forecastMae = perfData?.forecast_metrics?.model_metrics?.mae ?? 0.0216;
  const totalFaults = faultsData?.total_events ?? 5;

  // Cost figures for Deep Moss band
  const gridOnlyCost = compareData?.strategies?.grid_only?.total_cost ?? 6605.87;
  const ruleBasedCost = compareData?.strategies?.rule_based?.total_cost ?? 4909.02;
  const optimisedCost = compareData?.strategies?.optimised_lp?.total_cost ?? 4575.86;
  const ruleSavingsPct = compareData?.strategies?.rule_based?.savings_percent ?? 25.7;
  const optSavingsPct = compareData?.strategies?.optimised_lp?.savings_percent ?? 30.7;

  // Store numbers
  const batteryCycles = simData?.summary?.battery_cycles ?? 38.4;
  const peakGridImport = useMemo(() => {
    if (!simData?.hourly_series?.length) return 4.8;
    return Math.max(...simData.hourly_series.map((d) => d.grid_import_kw));
  }, [simData]);
  const selfSufficiencyPct = useMemo(() => {
    if (!simData?.summary) return 64.2;
    const load = simData.summary.building_load_kwh;
    const imp = simData.summary.grid_import_kwh;
    return load > 0 ? Math.max(0, Math.round(((load - imp) / load) * 1000) / 10) : 0;
  }, [simData]);

  // Modules metadata
  const modules = [
    {
      id: 0,
      title: 'FORECAST',
      label: 'Predictive Solar Irradiance',
      desc: 'Random Forest regressor trained strictly on healthy generation profiles, achieving 92.6% error reduction over standard persistence baselines.',
      path: '/forecast',
      component: simData?.hourly_series ? (
        <ShowcaseForecastChart data={simData.hourly_series} />
      ) : (
        <Skeleton className="w-full h-full" />
      ),
    },
    {
      id: 1,
      title: 'DETECT',
      label: 'Dual-Method Anomaly Inversion',
      desc: 'Combined residual threshold persistence and unsupervised Isolation Forest diagnostics identifying soiling, diode failure, and inverter degradation.',
      path: '/forecast?view=faults',
      component: simData?.hourly_series && faultsData ? (
        <ShowcaseFaultChart events={faultsData.events} data={simData.hourly_series} />
      ) : (
        <Skeleton className="w-full h-full" />
      ),
    },
    {
      id: 2,
      title: 'OPTIMISE',
      label: 'HiGHS Mixed-Integer Dispatch',
      desc: 'Global linear programming solution with multi-tier time-of-use tariffs, battery thermal health constraints, and zero simultaneous interchange penalty.',
      path: '/cost',
      component: compareData?.cumulative_costs ? (
        <ShowcaseCostChart data={compareData.cumulative_costs} />
      ) : (
        <Skeleton className="w-full h-full" />
      ),
    },
  ];

  const handleRetryAll = () => {
    refetchMeta();
    refetchSim();
    refetchCompare();
    refetchFaults();
    refetchPerf();
  };

  const hasError = metaError || simError || compError || faultsError || perfError;

  return (
    <div className="w-full bg-bg text-ink selection:bg-ink selection:text-bg">
      {/* 1. HERO (100svh) */}
      <section className="relative w-full h-[100svh] p-4 sm:p-5 md:p-6 box-border bg-bg flex flex-col justify-center">
        <div className="relative w-full h-full rounded-[16px] overflow-hidden border border-hairline/60 bg-ink">
          {/* Daylight Architectural Hero Photo */}
          <picture className="w-full h-full">
            <source srcSet="/images/hero.webp" type="image/webp" />
            <source srcSet="/images/hero.jpg" type="image/jpeg" />
            <img
              src="/images/hero.svg"
              alt="Daylight sustainable solar residence"
              className="w-full h-full object-cover object-center select-none"
            />
          </picture>

          {/* Soft ink scrim only at the bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/35 to-transparent pointer-events-none" />

          {/* Bottom Left: Huge Didone Wordmark */}
          <div className="absolute bottom-6 left-6 md:bottom-12 md:left-14 z-10 flex flex-col items-start select-none">
            <span className="font-serif font-light text-white text-[clamp(76px,14vw,220px)] leading-[0.82] tracking-[-0.025em] drop-shadow-sm">
              {BRAND_NAME}
            </span>
          </div>

          {/* Bottom Right: Tagline, Sans Paragraph & Scroll Cue */}
          <div className="absolute bottom-6 right-6 md:bottom-12 md:right-14 z-10 max-w-sm text-right flex flex-col items-end gap-3 text-white">
            <p className="font-serif italic text-lg md:text-xl text-white/95 leading-snug font-normal drop-shadow-sm">
              Renewable energy, managed with foresight.
            </p>
            <p className="text-ui text-white/80 font-light leading-relaxed hidden sm:block">
              Machine learning solar forecasting, dual-method fault diagnostics, and
              linear-programming battery storage optimization for architectural microgrids.
            </p>
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-label text-white/70 pt-2 select-none">
              <span>SCROLL</span>
              <div className="w-12 h-[1px] bg-white/40" />
            </div>
          </div>
        </div>
      </section>

      {/* Global Error Banner if backend fails */}
      {hasError && (
        <div className="max-w-[1320px] mx-auto px-6 pt-12">
          <ErrorState
            title="Telemetry Connection Alert"
            message="Could not stream full simulation parameters from the FastAPI microgrid engine. Please check that uvicorn is active on port 8000."
            onRetry={handleRetryAll}
          />
        </div>
      )}

      {/* 2. NUMBERS (Asymmetrical Staggered Grid) */}
      <section className="relative max-w-[1320px] mx-auto px-6 py-28 md:py-44">
        <div className="flex items-center justify-between pb-8 mb-16 border-b border-hairline">
          <Label variant="parenthesised">(01) PERFORMANCE ATTRIBUTION</Label>
          <span className="text-caption text-muted font-sans tabular-nums">
            Horizon: {startDate.slice(0, 10)} → {endDate.slice(0, 10)} ({timeWindow})
          </span>
        </div>

        {metaLoading || compLoading || perfLoading || faultsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
            <Skeleton className="md:col-span-4 h-36" />
            <Skeleton className="md:col-span-4 md:col-start-8 h-36 mt-16" />
            <Skeleton className="md:col-span-4 md:col-start-2 h-36 mt-20" />
            <Skeleton className="md:col-span-4 md:col-start-7 h-36 mt-12" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-y-20 md:gap-y-32 gap-x-8">
            {/* Number 1: Savings vs Grid-Only (%) */}
            <div className="col-span-12 md:col-span-5 md:pt-0">
              <DisplayNumber
                value={<CountUp to={savingsPercent} decimals={1} />}
                unit="%"
                captionLine1="Savings vs grid-only"
                captionLine2="Optimised LP dispatch over baseline"
                size="xl"
              />
            </div>

            {/* Number 2: Solar Self-Consumption (%) */}
            <div className="col-span-12 md:col-span-4 md:col-start-8 md:pt-28">
              <DisplayNumber
                value={<CountUp to={selfConsumptionPercent} decimals={1} />}
                unit="%"
                captionLine1="Solar self-consumption"
                captionLine2="On-site clean solar energy utilized"
                size="xl"
              />
            </div>

            {/* Number 3: Forecast MAE (kW) */}
            <div className="col-span-12 md:col-span-4 md:col-start-2 md:pt-36">
              <DisplayNumber
                value={<CountUp to={forecastMae} decimals={4} />}
                unit="kW"
                captionLine1="Forecast Mean Absolute Error"
                captionLine2="Random Forest test benchmark"
                size="xl"
              />
            </div>

            {/* Number 4: Faults Detected (count) */}
            <div className="col-span-12 md:col-span-4 md:col-start-7 md:pt-16">
              <DisplayNumber
                value={<CountUp to={totalFaults} />}
                unit="events"
                captionLine1="Fault events detected"
                captionLine2="Isolation Forest & residual hybrid"
                size="xl"
              />
            </div>
          </div>
        )}
      </section>

      {/* 3. MODULE SHOWCASE (3 Panels, Taller Centre, Overlapping Serif Title) */}
      <section className="relative max-w-[1320px] mx-auto px-6 py-28 border-t border-hairline">
        {/* Top Header Row */}
        <div className="flex items-center justify-between mb-12">
          <Label variant="parenthesised">(OUR MODULES)</Label>
          <div className="flex items-center gap-3">
            {[0, 1, 2].map((idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveModule(idx)}
                className={`font-serif text-sm transition-colors cursor-pointer ${
                  activeModule === idx ? 'text-ink font-medium underline underline-offset-4' : 'text-muted hover:text-ink'
                }`}
              >
                ({idx + 1})
              </button>
            ))}
          </div>
        </div>

        {/* Overlapping Centred Title */}
        <div className="relative text-center z-20 pointer-events-none mb-[-36px] md:mb-[-48px]">
          <h2 className="text-display font-serif font-light text-ink tracking-tight uppercase select-none opacity-90 drop-shadow-sm">
            {modules[activeModule].title}
          </h2>
        </div>

        {/* 3 Panels Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Panel */}
          <div
            onClick={() => setActiveModule((activeModule + 2) % 3)}
            className="lg:col-span-3 h-56 md:h-64 bg-surface border border-hairline rounded-control p-4 overflow-hidden cursor-pointer hover:border-ink/40 transition-all opacity-75 hover:opacity-100 hidden lg:block"
          >
            <div className="text-[11px] uppercase tracking-label text-muted mb-2">
              {modules[(activeModule + 2) % 3].label}
            </div>
            <div className="h-44">{modules[(activeModule + 2) % 3].component}</div>
          </div>

          {/* Centre Panel (Taller, Primary) */}
          <div className="lg:col-span-6 h-88 md:h-[420px] bg-raised border border-hairline rounded-control p-6 md:p-8 flex flex-col justify-between shadow-sm relative z-10">
            <div className="flex items-center justify-between pb-3 border-b border-hairline/60">
              <span className="text-[11px] uppercase tracking-label text-ink font-medium">
                {modules[activeModule].label}
              </span>
              <span className="text-caption text-muted">Active Horizon Live</span>
            </div>

            <div className="w-full flex-grow py-3">
              {modules[activeModule].component}
            </div>

            <div className="pt-4 border-t border-hairline/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-caption text-muted max-w-sm leading-relaxed">
                {modules[activeModule].desc}
              </p>
              <PillButton
                variant="primary"
                onClick={() => navigate(modules[activeModule].path)}
              >
                Open Module
              </PillButton>
            </div>
          </div>

          {/* Right Panel */}
          <div
            onClick={() => setActiveModule((activeModule + 1) % 3)}
            className="lg:col-span-3 h-56 md:h-64 bg-surface border border-hairline rounded-control p-4 overflow-hidden cursor-pointer hover:border-ink/40 transition-all opacity-75 hover:opacity-100 hidden lg:block"
          >
            <div className="text-[11px] uppercase tracking-label text-muted mb-2">
              {modules[(activeModule + 1) % 3].label}
            </div>
            <div className="h-44">{modules[(activeModule + 1) % 3].component}</div>
          </div>
        </div>
      </section>

      {/* 4. STORE SECTION (Split: Battery SoC Chart on Left, 3 DisplayNumbers on Right) */}
      <section className="relative max-w-[1320px] mx-auto px-6 py-28 border-t border-hairline">
        <div className="mb-12">
          <Label variant="parenthesised">(02) ENERGY STORAGE ARCHITECTURE</Label>
          <h2 className="text-h2 font-serif font-light text-ink mt-2">
            Dynamic Storage & Grid Interchange
          </h2>
          <p className="text-muted text-body max-w-2xl mt-1">
            Battery charge and discharge profiles scheduled by linear optimization to maximize self-consumption and absorb surplus solar.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: Battery State of Charge Chart */}
          <div className="lg:col-span-7 bg-raised border border-hairline rounded-control p-6">
            <div className="flex items-center justify-between pb-4 border-b border-hairline mb-4">
              <span className="text-[11px] uppercase tracking-label text-muted font-normal">
                Battery State of Charge & Power Flow
              </span>
              <span className="text-caption text-muted font-serif italic">
                Capacity: {batteryKwh.toFixed(1)} kWh · Power: {batteryKw.toFixed(1)} kW
              </span>
            </div>
            {simLoading ? (
              <Skeleton className="w-full h-80" />
            ) : simData?.hourly_series ? (
              <BatterySocChart data={simData.hourly_series} height={320} />
            ) : (
              <div className="h-80 flex items-center justify-center text-muted font-serif italic">
                No storage telemetry available
              </div>
            )}
          </div>

          {/* Right: Three DisplayNumbers + TextLink */}
          <div className="lg:col-span-5 flex flex-col gap-10 lg:pl-6">
            <DisplayNumber
              value={<CountUp to={batteryCycles} decimals={1} />}
              unit="cycles"
              captionLine1="Battery throughput cycles"
              captionLine2="Accumulated equivalent full charge cycles"
              size="lg"
            />

            <DisplayNumber
              value={<CountUp to={peakGridImport} decimals={2} />}
              unit="kW"
              captionLine1="Peak grid import demand"
              captionLine2="Suppressed through stored PV capacity"
              size="lg"
            />

            <DisplayNumber
              value={<CountUp to={selfSufficiencyPct} decimals={1} />}
              unit="%"
              captionLine1="Building self-sufficiency"
              captionLine2="Proportion of load supplied without grid"
              size="lg"
            />

            <div className="pt-4">
              <TextLink href="/energy" onClick={(e) => { e.preventDefault(); navigate('/energy'); }}>
                Explore Full Energy Dispatch Matrix
              </TextLink>
            </div>
          </div>
        </div>
      </section>

      {/* 5. OPTIMISE (The Deep-Moss Band, Full-Bleed with 16px Corners) */}
      <section className="max-w-[1320px] mx-auto px-4 sm:px-6 my-28">
        <div className="w-full bg-moss text-moss-text rounded-[16px] py-20 md:py-28 px-6 sm:px-12 md:px-16 border border-hairline/20 shadow-md">
          {/* Section Heading */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[11px] uppercase tracking-label text-moss-text/60 font-normal block mb-3">
              (03) FINANCIAL OPTIMIZATION
            </span>
            <h2 className="text-h1 font-serif italic text-[#FAF7F2] font-light leading-[1.05]">
              The same sun. A smaller bill.
            </h2>
            <p className="text-moss-text/80 text-body mt-4 font-light">
              Multi-tariff linear programming resolves time-of-use costs globally, mitigating import expenditure during high-tariff evening hours.
            </p>
          </div>

          {/* Three Large Figures */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 pb-16 border-b border-hairline/20 text-center">
            {/* Strategy 1: Grid-Only */}
            <div className="flex flex-col items-center">
              <span className="text-caption text-moss-text/60 uppercase tracking-label mb-2">
                Grid-only baseline
              </span>
              <div className="font-serif font-light text-5xl sm:text-6xl text-[#FAF7F2] tabular-nums">
                ₹ <CountUp to={gridOnlyCost} decimals={2} />
              </div>
              <span className="text-caption text-moss-text/50 font-serif italic mt-1">
                No battery buffer
              </span>

              {/* Horizontal Bar (100%) */}
              <div className="w-full max-w-[200px] h-[3px] bg-moss-text/20 mt-6 rounded-full overflow-hidden">
                <div className="h-full bg-moss-text/70 w-full" />
              </div>
            </div>

            {/* Strategy 2: Rule-Based */}
            <div className="flex flex-col items-center">
              <span className="text-caption text-moss-text/60 uppercase tracking-label mb-2">
                Rule-based self-consumption
              </span>
              <div className="font-serif font-light text-5xl sm:text-6xl text-[#FAF7F2] tabular-nums">
                ₹ <CountUp to={ruleBasedCost} decimals={2} />
              </div>
              <span className="text-caption text-battery font-sans font-medium mt-1">
                −{ruleSavingsPct.toFixed(1)}% savings
              </span>

              {/* Horizontal Bar Proportional */}
              <div className="w-full max-w-[200px] h-[3px] bg-moss-text/20 mt-6 rounded-full overflow-hidden">
                <div
                  className="h-full bg-battery"
                  style={{ width: `${Math.min(100, Math.max(10, (ruleBasedCost / gridOnlyCost) * 100))}%` }}
                />
              </div>
            </div>

            {/* Strategy 3: Optimised LP */}
            <div className="flex flex-col items-center">
              <span className="text-caption text-moss-text/60 uppercase tracking-label mb-2">
                Optimised linear program
              </span>
              <div className="font-serif font-light text-5xl sm:text-6xl text-[#FAF7F2] tabular-nums">
                ₹ <CountUp to={optimisedCost} decimals={2} />
              </div>
              <span className="text-caption text-solar font-sans font-medium mt-1">
                −{optSavingsPct.toFixed(1)}% savings
              </span>

              {/* Horizontal Bar Proportional */}
              <div className="w-full max-w-[200px] h-[3px] bg-moss-text/20 mt-6 rounded-full overflow-hidden">
                <div
                  className="h-full bg-solar"
                  style={{ width: `${Math.min(100, Math.max(10, (optimisedCost / gridOnlyCost) * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {/* CTA at Bottom */}
          <div className="pt-12 text-center">
            <PillButton
              variant="light"
              onClick={() => navigate('/cost')}
            >
              See the full comparison
            </PillButton>
          </div>
        </div>
      </section>

      {/* 6. PRINCIPLES SECTION (Translucent Tiles over Background + Model Metrics) */}
      <section className="relative max-w-[1320px] mx-auto px-6 py-28 border-t border-hairline">
        <div className="mb-14">
          <Label variant="parenthesised">(04) SCIENTIFIC RIGOR & METHODOLOGY</Label>
          <h2 className="text-h2 font-serif font-light text-ink mt-2">
            Principles of Empirical Simulation
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* 4 Translucent Tiles */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-6 bg-surface/90 border border-hairline rounded-control shadow-sm">
              <Label variant="parenthesised">(01)</Label>
              <h3 className="font-serif italic text-xl font-normal text-ink mt-2 mb-2">
                Chronological Validation
              </h3>
              <p className="text-caption text-muted font-sans leading-relaxed">
                Strict sequential time-series partition preserves real temporal causality without shuffling or information leakage.
              </p>
            </div>

            <div className="p-6 bg-surface/90 border border-hairline rounded-control shadow-sm">
              <Label variant="parenthesised">(02)</Label>
              <h3 className="font-serif italic text-xl font-normal text-ink mt-2 mb-2">
                Zero Data Leakage
              </h3>
              <p className="text-caption text-muted font-sans leading-relaxed">
                Forecaster trains solely on confirmed fault-free daytime data; battery dispatch operates strictly on predicted solar.
              </p>
            </div>

            <div className="p-6 bg-surface/90 border border-hairline rounded-control shadow-sm">
              <Label variant="parenthesised">(03)</Label>
              <h3 className="font-serif italic text-xl font-normal text-ink mt-2 mb-2">
                Verified Energy Balance
              </h3>
              <p className="text-caption text-muted font-sans leading-relaxed">
                Physical conservation law is strictly verified at each hourly timestep across PV, battery storage, and the bidirectional grid.
              </p>
            </div>

            <div className="p-6 bg-surface/90 border border-hairline rounded-control shadow-sm">
              <Label variant="parenthesised">(04)</Label>
              <h3 className="font-serif italic text-xl font-normal text-ink mt-2 mb-2">
                Honest Baselines
              </h3>
              <p className="text-caption text-muted font-sans leading-relaxed">
                Economic savings and predictive gains are benchmarked against naive persistence and unconstrained grid import models.
              </p>
            </div>
          </div>

          {/* Right Side: Key Model Figures */}
          <div className="lg:col-span-5 bg-surface border border-hairline rounded-control p-8 space-y-6">
            <div>
              <span className="text-[11px] uppercase tracking-label text-muted font-normal block mb-1">
                Evaluation Metrics
              </span>
              <h3 className="text-h3 font-serif font-light text-ink">
                Verified Model Performance
              </h3>
              <p className="text-caption text-muted font-sans mt-2 leading-relaxed">
                Pre-trained machine learning checkpoints evaluated on 2,128 held-out test hours in the simulation environment.
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-hairline">
              <div className="flex items-baseline justify-between">
                <span className="text-ui text-muted">Forecasting Coefficient R²</span>
                <span className="font-serif text-2xl font-light text-ink tabular-nums">
                  {perfData?.forecast_metrics?.model_metrics?.r2?.toFixed(4) ?? '0.9993'}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-ui text-muted">MAE Improvement vs Naive</span>
                <span className="font-serif text-2xl font-light text-battery tabular-nums">
                  +{perfData?.forecast_metrics?.evaluation_summary?.mae_improvement_percent?.toFixed(1) ?? '92.6'}%
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-ui text-muted">Combined Fault F1-Score</span>
                <span className="font-serif text-2xl font-light text-ink tabular-nums">
                  {perfData?.fault_metrics?.combined_hybrid?.f1?.toFixed(3) ?? '0.738'}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-hairline">
              <TextLink href="/models" onClick={(e) => { e.preventDefault(); navigate('/models'); }}>
                Inspect Residual Scatter & Diagnostic Matrix
              </TextLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
