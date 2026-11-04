import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalState } from '../context/GlobalStateContext';
import {
  useMetaQuery,
  useSimulateQuery,
  useCompareQuery,
  useFaultsQuery,
  useModelPerformanceQuery,
} from '../api/client';
import { Label } from '../components/ui/Label';
import { PillButton, TextLink } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import {
  ShowcaseForecastChart,
  ShowcaseFaultChart,
  ShowcaseCostChart,
  BatterySocChart,
} from '../components/charts/HomeCharts';
import {
  CurtainSection,
  HeroMotion,
  MaskedLines,
  MotionNumeral,
  ShowcaseCarousel,
  ParallaxBox,
  PrinciplesMotion,
} from '../motion';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { window: timeWindow, strategy, batteryKwh, batteryKw } = useGlobalState();

  // 1. Fetch metadata
  const { data: meta, isLoading: metaLoading, error: metaError, refetch: refetchMeta } = useMetaQuery();

  // 2. Date horizon from nav toggle ending at latest date in /api/meta
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

  // Metrics from API
  const savingsPercent = compareData?.strategies?.optimised_lp?.savings_percent ?? 31.7;
  const selfConsumptionPercent = compareData?.strategies?.optimised_lp?.solar_self_consumption_percent ?? 86.6;
  const forecastMae = perfData?.forecast_metrics?.model_metrics?.mae ?? 0.0216;
  const totalFaults = faultsData?.total_events ?? 3;
  const mae =
    forecastMae < 0.1
      ? { value: forecastMae * 1000, decimals: 1, unit: 'W' }
      : { value: forecastMae, decimals: 2, unit: 'kW' };

  // Horizon label: one date for a day window, a range otherwise
  const startShort = startDate.slice(0, 10);
  const endShort = endDate.slice(0, 10);
  const horizonLabel =
    startShort === endShort
      ? `Horizon: ${endShort} (day)`
      : `Horizon: ${startShort} → ${endShort} (${timeWindow})`;

  // Costs for Optimise Deep-Moss Band
  const gridOnlyCost = compareData?.strategies?.grid_only?.total_cost ?? 1511.82;
  const ruleBasedCost = compareData?.strategies?.rule_based?.total_cost ?? 1090.42;
  const optimisedCost = compareData?.strategies?.optimised_lp?.total_cost ?? 1032.27;
  const ruleSavingsPct = compareData?.strategies?.rule_based?.savings_percent ?? 27.9;
  const optSavingsPct = compareData?.strategies?.optimised_lp?.savings_percent ?? 31.7;

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

  // Modules metadata with clean, correct titles matching reference
  const modules = useMemo(
    () => [
      {
        id: 0,
        title: 'Solar forecast',
        label: 'Solar forecast',
        desc: 'Random Forest regressor trained strictly on healthy generation profiles, predicting next-day solar generation from weather and time features.',
        path: '/forecast',
        chart: simData?.hourly_series ? (
          <ShowcaseForecastChart data={simData.hourly_series} />
        ) : (
          <Skeleton className="w-full h-full" />
        ),
      },
      {
        id: 1,
        title: 'Fault detection',
        label: 'Fault detection',
        desc: 'Hybrid diagnostics combining physics-based generation residuals and Isolation Forest to detect panel soiling, shading, and inverter trips.',
        path: '/forecast?view=faults',
        chart: simData?.hourly_series ? (
          <ShowcaseFaultChart events={faultsData?.events || []} data={simData.hourly_series} />
        ) : (
          <Skeleton className="w-full h-full" />
        ),
      },
      {
        id: 2,
        title: 'Battery optimisation',
        label: 'Battery optimisation',
        desc: 'Linear programming solver (SciPy HiGHS) determining cost-optimal charge, discharge, import, and export schedules across time-of-use tariffs.',
        path: '/cost',
        chart: compareData?.cumulative_costs ? (
          <ShowcaseCostChart data={compareData.cumulative_costs} />
        ) : (
          <Skeleton className="w-full h-full" />
        ),
      },
    ],
    [simData, faultsData, compareData]
  );

  const principleTiles = useMemo(
    () => [
      {
        num: '(01)',
        title: 'Chronological Validation',
        text: 'Strict sequential time-series partition preserves real temporal causality without shuffling or look-ahead bias across all 8,760 hours.',
      },
      {
        num: '(02)',
        title: 'Zero Data Leakage',
        text: 'Forecaster trains solely on confirmed fault-free daytime hours; battery dispatch operates strictly on predicted solar.',
      },
      {
        num: '(03)',
        title: 'Verified Energy Balance',
        text: 'Physical conservation laws are verified at each hourly timestep across PV, battery storage, building load, and bidirectional grid.',
      },
      {
        num: '(04)',
        title: 'Honest Baselines',
        text: 'Economic savings and predictive accuracy are benchmarked against naive persistence and unconstrained grid-only imports.',
      },
    ],
    []
  );

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
      {/* 1. HERO (100svh Entry & Scroll Exit) */}
      <HeroMotion />

      {/* Global Error Banner if API fails */}
      {hasError && (
        <div className="max-w-[1320px] mx-auto px-6 pt-12">
          <ErrorState
            title="Telemetry Stream Alert"
            message="Could not stream simulation telemetry from FastAPI backend on port 8000. Verify that uvicorn is running."
            onRetry={handleRetryAll}
          />
        </div>
      )}

      {/* Empty State Banner if no data */}
      {!metaLoading && !hasError && (!simData || !compareData) && (
        <div className="max-w-[1320px] mx-auto px-6 pt-12">
          <EmptyState
            title="No Active Microgrid Telemetry"
            description="The simulation stream is currently unpopulated for the configured time window."
            actionLabel="Re-poll Telemetry"
            onAction={handleRetryAll}
          />
        </div>
      )}

      {/* 2. NUMBERS — compact asymmetrical stagger */}
      <CurtainSection id="numbers" zIndex={10} wipeDistance={280}>
        <section className="relative max-w-[1320px] mx-auto px-6 pt-16 md:pt-20 pb-20 md:pb-28">
          <div className="pb-6 mb-12 md:mb-16 border-b border-hairline">
            <div className="flex items-center justify-between mb-3">
              <Label variant="parenthesised">(01) PERFORMANCE ATTRIBUTION</Label>
              <span className="text-caption text-muted font-sans tabular-nums">
                {horizonLabel}
              </span>
            </div>
            <MaskedLines
              text="Every kilowatt-hour, *verified.*"
              as="h2"
              className="text-h2 font-serif font-light text-ink"
            />
          </div>

          {metaLoading || compLoading || perfLoading || faultsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-10">
              <Skeleton className="md:col-start-1 md:col-span-5 h-36" />
              <Skeleton className="md:col-start-7 md:col-span-5 h-36 md:mt-20" />
              <Skeleton className="md:col-start-3 md:col-span-4 h-36" />
              <Skeleton className="md:col-start-9 md:col-span-4 h-36 md:mt-16" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-12 md:gap-y-14">
              {/* Row 1, left: Savings */}
              <div className="md:col-start-1 md:col-span-5">
                <MotionNumeral
                  value={savingsPercent}
                  decimals={1}
                  unit="%"
                  captionLine1="Savings vs grid-only"
                  captionLine2="Optimised LP dispatch over baseline"
                  staggerIndex={0}
                  size="xl"
                />
              </div>

              {/* Row 1, right, dropped: Self-consumption */}
              <div className="md:col-start-7 md:col-span-5 md:mt-20">
                <MotionNumeral
                  value={selfConsumptionPercent}
                  decimals={1}
                  unit="%"
                  captionLine1="Solar self-consumption"
                  captionLine2="On-site solar energy utilised"
                  staggerIndex={1}
                  size="xl"
                />
              </div>

              {/* Row 2, left-centre: Forecast error */}
              <div className="md:col-start-3 md:col-span-4">
                <MotionNumeral
                  value={mae.value}
                  decimals={mae.decimals}
                  unit={mae.unit}
                  captionLine1="Forecast mean absolute error"
                  captionLine2="Random Forest, held-out test set"
                  staggerIndex={2}
                  size="xl"
                />
              </div>

              {/* Row 2, right, dropped: Faults */}
              <div className="md:col-start-9 md:col-span-4 md:mt-16">
                <MotionNumeral
                  value={totalFaults}
                  decimals={0}
                  unit={totalFaults === 1 ? 'event' : 'events'}
                  captionLine1={totalFaults === 1 ? 'Fault event detected' : 'Fault events detected'}
                  captionLine2="Isolation Forest and residual hybrid"
                  staggerIndex={3}
                  size="xl"
                />
              </div>
            </div>
          )}
        </section>
      </CurtainSection>

      {/* 3. MODULE SHOWCASE (Curtain Section with Auto-Advancing 3-Panel Carousel) */}
      <CurtainSection id="showcase" zIndex={20} wipeDistance={550}>
        <section className="relative max-w-[1320px] mx-auto px-6 py-28">
          <div className="mb-6">
            <MaskedLines
              text="*Know tomorrow's sunshine today.*"
              as="h2"
              className="text-h2 font-serif font-light text-ink text-center mb-2"
            />
          </div>
          <ShowcaseCarousel modules={modules} />
        </section>
      </CurtainSection>

      {/* 4. STORE SECTION (Curtain Section with Battery SoC Chart Parallax + Numbers) */}
      <CurtainSection id="store" zIndex={30} wipeDistance={550}>
        <section className="relative max-w-[1320px] mx-auto px-6 py-28">
          <div className="mb-12">
            <Label variant="parenthesised">(02) ENERGY STORAGE ARCHITECTURE</Label>
            <MaskedLines
              text="Every watt, *accounted for.*"
              as="h2"
              className="text-h2 font-serif font-light text-ink mt-2"
            />
            <p className="text-muted text-body max-w-2xl mt-1">
              Battery charge and discharge profiles scheduled by linear optimization to maximize self-consumption and absorb surplus solar.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left: Battery SoC Chart with 0.85x Parallax */}
            <div className="lg:col-span-7">
              <ParallaxBox speed={0.85} className="bg-raised border border-hairline rounded-control p-6 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-hairline mb-4 -mx-6 -mt-6">
                  <span className="text-[11px] uppercase tracking-label text-muted font-normal">
                    Battery State of Charge & Power Flow
                  </span>
                  <span className="text-caption text-muted font-sans tabular-nums whitespace-nowrap">
                    Capacity: {batteryKwh.toFixed(1)} kWh · Power: {batteryKw.toFixed(1)} kW
                  </span>
                </div>
                {simLoading ? (
                  <Skeleton className="w-full h-80" />
                ) : simData?.hourly_series ? (
                  <BatterySocChart data={simData.hourly_series} height={320} />
                ) : (
                  <div className="h-80 flex items-center justify-center text-muted font-sans text-caption">
                    No storage telemetry available
                  </div>
                )}
              </ParallaxBox>
            </div>

            {/* Right: Three Motion Numerals + Text Link */}
            <div className="lg:col-span-5 flex flex-col gap-10 lg:pl-6">
              <MotionNumeral
                value={batteryCycles}
                decimals={1}
                unit="cycles"
                captionLine1="Battery throughput cycles"
                captionLine2="Accumulated equivalent full charge cycles"
                staggerIndex={0}
                size="lg"
              />

              <MotionNumeral
                value={peakGridImport}
                decimals={2}
                unit="kW"
                captionLine1="Peak grid import demand"
                captionLine2="Suppressed through stored PV capacity"
                staggerIndex={1}
                size="lg"
              />

              <MotionNumeral
                value={selfSufficiencyPct}
                decimals={1}
                unit="%"
                captionLine1="Building self-sufficiency"
                captionLine2="Proportion of load supplied without grid"
                staggerIndex={2}
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
      </CurtainSection>

      {/* 5. OPTIMISE (The Deep-Moss Band Curtain Section with Proportional Bars) */}
      <CurtainSection id="optimise" zIndex={40} wipeDistance={550}>
        <section className="max-w-[1320px] mx-auto px-4 sm:px-6 my-28">
          <div className="w-full bg-moss text-moss-text rounded-[16px] py-20 md:py-28 px-6 sm:px-12 md:px-16 border border-hairline/20 shadow-md">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-[11px] uppercase tracking-label text-moss-text/60 font-normal block mb-3">
                (03) FINANCIAL OPTIMIZATION
              </span>
              <MaskedLines
                text="*The same sun.* A smaller bill."
                as="h2"
                className="text-h1 font-serif italic text-[#FAF7F2] font-light leading-[1.05]"
              />
              <p className="text-moss-text/80 text-body mt-4 font-light">
                Multi-tariff linear programming resolves time-of-use costs globally, mitigating import expenditure during high-tariff evening hours.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 pb-16 border-b border-hairline/20 text-center">
              {/* Strategy 1: Grid-Only */}
              <div className="flex flex-col items-center">
                <span className="text-caption text-moss-text/60 uppercase tracking-label mb-2">
                  Grid-only baseline
                </span>
                <div className="font-serif font-light text-5xl sm:text-6xl text-[#FAF7F2] tabular-nums">
                  ₹ {gridOnlyCost.toFixed(2)}
                </div>
                <span className="text-caption text-moss-text/50 font-serif italic mt-1">
                  No battery buffer
                </span>
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
                  ₹ {ruleBasedCost.toFixed(2)}
                </div>
                <span className="text-caption text-battery font-sans font-medium mt-1">
                  ₹{Math.max(0, gridOnlyCost - ruleBasedCost).toFixed(2)} saved · {ruleSavingsPct.toFixed(1)}% lower
                </span>
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
                  ₹ {optimisedCost.toFixed(2)}
                </div>
                <span className="text-caption text-solar font-sans font-medium mt-1">
                  ₹{Math.max(0, gridOnlyCost - optimisedCost).toFixed(2)} saved · {optSavingsPct.toFixed(1)}% lower
                </span>
                <div className="w-full max-w-[200px] h-[3px] bg-moss-text/20 mt-6 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-solar"
                    style={{ width: `${Math.min(100, Math.max(10, (optimisedCost / gridOnlyCost) * 100))}%` }}
                  />
                </div>
              </div>
            </div>

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
      </CurtainSection>

      {/* 6. PRINCIPLES SECTION (Curtain Section with Background Dim & Staggered Tiles) */}
      <CurtainSection id="principles" zIndex={50} isLast={true}>
        <section className="relative max-w-[1320px] mx-auto px-6 py-28">
          <div className="mb-14">
            <Label variant="parenthesised">(04) SCIENTIFIC RIGOR & METHODOLOGY</Label>
            <MaskedLines
              text="Built to be *checked.*"
              as="h2"
              className="text-h2 font-serif font-light text-ink mt-2"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* 4 Translucent Tiles with Background Dim Reveal */}
            <div className="lg:col-span-7">
              <PrinciplesMotion tiles={principleTiles} />
            </div>

            {/* Right Side: Key Model Evaluation Figures */}
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
      </CurtainSection>
    </div>
  );
};

export default Home;
