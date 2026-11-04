import React, { useState } from 'react';
import { PillButton, TextLink } from '../components/ui/Button';
import { Label } from '../components/ui/Label';
import { SectionHeading } from '../components/ui/SectionHeading';
import { DisplayNumber } from '../components/ui/DisplayNumber';
import { Stat } from '../components/ui/Stat';
import { Panel } from '../components/ui/Panel';
import { DataTable } from '../components/ui/DataTable';
import { Segmented } from '../components/ui/Segmented';
import { TextToggle } from '../components/ui/TextToggle';
import { Tabs } from '../components/ui/Tabs';
import { Select } from '../components/ui/Select';
import { Slider } from '../components/ui/Slider';
import { NumberInput } from '../components/ui/NumberInput';
import { Tooltip } from '../components/ui/Tooltip';
import { Badge } from '../components/ui/Badge';
import { DateRangePicker } from '../components/ui/DateRangePicker';
import { SideSheet } from '../components/ui/SideSheet';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Reveal } from '../components/ui/Reveal';
import { CountUp } from '../components/ui/CountUp';
import { SplitLines } from '../components/ui/SplitLines';
import { SampleChart } from '../components/charts/SampleChart';

const DesignPreview: React.FC = () => {
  const [toggleVal, setToggleVal] = useState<'day' | 'week' | 'month'>('week');
  const [segmentedVal, setSegmentedVal] = useState<'optimised' | 'rule' | 'grid'>('optimised');
  const [sliderVal, setSliderVal] = useState<number>(10.0);
  const [selectVal, setSelectVal] = useState<string>('optimised_lp');
  const [startDate, setStartDate] = useState('2026-05-26');
  const [endDate, setEndDate] = useState('2026-06-01');
  const [isSideSheetOpen, setIsSideSheetOpen] = useState(false);

  const sampleTableData = [
    { period: '2026-01', solar: '904.7 kWh', load: '1,414.5 kWh', cost: '₹ 4,575.86', savings: '30.7%' },
    { period: '2026-02', solar: '1,024.3 kWh', load: '1,320.1 kWh', cost: '₹ 4,112.40', savings: '33.2%' },
    { period: '2026-03', solar: '1,280.9 kWh', load: '1,502.8 kWh', cost: '₹ 4,380.12', savings: '36.5%' },
  ];

  return (
    <div className="pt-28 pb-32 max-w-[1320px] mx-auto px-6 space-y-24">
      {/* Header */}
      <div>
        <Label variant="parenthesised">(SYSTEM ARCHITECTURE)</Label>
        <h1 className="text-display font-serif font-light text-ink mt-2 mb-4">
          Design Foundation
        </h1>
        <p className="text-body text-muted max-w-2xl font-light">
          Warm ivory base (#F5F1EA), Bodoni Moda display serif (optical size 96, weight 400),
          Inter UI sans-serif, hairline rules, tabular numerals, and dedicated data colors.
        </p>
      </div>

      {/* 1. Color Palette Tokens */}
      <section className="space-y-6">
        <SectionHeading
          eyebrow="(01) COLOR MATRIX"
          title="Atmospheric & Data Palette"
          subtitle="Strict contrast ratios with single deep-moss band (#1F2B26) and accessible text brass (#8A6A38 >= 4.5:1)."
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-4 bg-bg border border-hairline rounded-control">
            <div className="text-ui font-medium">Ivory Base</div>
            <div className="text-caption text-muted">#F5F1EA</div>
          </div>
          <div className="p-4 bg-surface border border-hairline rounded-control">
            <div className="text-ui font-medium">Surface</div>
            <div className="text-caption text-muted">#FBF9F5</div>
          </div>
          <div className="p-4 bg-raised border border-hairline rounded-control shadow-sm">
            <div className="text-ui font-medium">Raised Card</div>
            <div className="text-caption text-muted">#FFFFFF</div>
          </div>
          <div className="p-4 bg-ink text-bg rounded-control">
            <div className="text-ui font-medium">Ink</div>
            <div className="text-caption text-bg/70">#1B1F1D</div>
          </div>
          <div className="p-4 bg-moss text-moss-text rounded-control">
            <div className="text-ui font-medium">Deep Moss</div>
            <div className="text-caption text-moss-text/70">#1F2B26</div>
          </div>
          <div className="p-4 bg-surface border border-hairline rounded-control">
            <div className="text-ui font-medium text-brass-text">Brass Text (AA)</div>
            <div className="text-caption text-muted">#8A6A38</div>
          </div>
        </div>

        {/* Data Colors */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 pt-4">
          <div className="p-3 bg-[#D9941E]/10 border border-[#D9941E]/30 rounded-control">
            <div className="text-ui font-medium text-[#A66E11]">Solar PV</div>
            <div className="text-caption text-muted">#D9941E</div>
          </div>
          <div className="p-3 bg-[#3F8F6B]/10 border border-[#3F8F6B]/30 rounded-control">
            <div className="text-ui font-medium text-[#2C6A4F]">Battery</div>
            <div className="text-caption text-muted">#3F8F6B</div>
          </div>
          <div className="p-3 bg-[#5F7A8C]/10 border border-[#5F7A8C]/30 rounded-control">
            <div className="text-ui font-medium text-[#435968]">Grid Power</div>
            <div className="text-caption text-muted">#5F7A8C</div>
          </div>
          <div className="p-3 bg-[#8A8578]/10 border border-[#8A8578]/30 rounded-control">
            <div className="text-ui font-medium text-[#615D53]">Building Load</div>
            <div className="text-caption text-muted">#8A8578</div>
          </div>
          <div className="p-3 bg-[#C4513F]/10 border border-[#C4513F]/30 rounded-control">
            <div className="text-ui font-medium text-[#A53A2A]">Fault Inversion</div>
            <div className="text-caption text-muted">#C4513F</div>
          </div>
          <div className="p-3 bg-surface border border-dashed border-[#D9941E] rounded-control">
            <div className="text-ui font-medium text-[#A66E11]">Forecast (60%)</div>
            <div className="text-caption text-muted">rgba(217, 148, 30, 0.6)</div>
          </div>
        </div>
      </section>

      {/* 2. Typography Scale */}
      <section className="space-y-6">
        <SectionHeading
          eyebrow="(02) TYPOGRAPHY"
          title="Editorial Scale & Optical Sizing"
          subtitle="Display serif reserved for 28px and above at lightest weight with high optical size (opsz 96); Inter for small, quiet UI elements."
        />
        <div className="space-y-6 p-8 bg-surface border border-hairline rounded-frame">
          <div className="pb-4 border-b border-hairline">
            <span className="text-caption text-muted block mb-1">Display 88px (Bodoni Moda Light opsz 96)</span>
            <div className="text-display font-serif font-light text-ink">Solar Generation</div>
          </div>
          <div className="pb-4 border-b border-hairline">
            <span className="text-caption text-muted block mb-1">Heading 1 64px</span>
            <div className="text-h1 font-serif font-light text-ink">Predictive Irradiance</div>
          </div>
          <div className="pb-4 border-b border-hairline">
            <span className="text-caption text-muted block mb-1">Heading 2 44px</span>
            <div className="text-h2 font-serif font-light text-ink">Energy Management & Dispatch</div>
          </div>
          <div className="pb-4 border-b border-hairline">
            <span className="text-caption text-muted block mb-1">Heading 3 28px</span>
            <div className="text-h3 font-serif font-normal text-ink">Optimised Horizon Analysis</div>
          </div>
          <div className="pb-4 border-b border-hairline">
            <span className="text-caption text-muted block mb-1">Body 15px & UI 13px (Inter)</span>
            <p className="text-body text-ink max-w-xl">
              Solar flux is converted through high-efficiency monocrystalline PV modules with empirical
              thermal derating factors. Dispatch schedules are solved globally via SciPy HiGHS.
            </p>
          </div>
          <div>
            <span className="text-caption text-muted block mb-1">Tabular Numerals</span>
            <div className="text-h2 font-serif tabular-nums text-ink">
              123,456.78 kWh · 98.76% · ₹ 4,575.86
            </div>
          </div>
        </div>
      </section>

      {/* 3. Component Gallery */}
      <section className="space-y-8">
        <SectionHeading
          eyebrow="(03) CONTROLS & COMPONENTS"
          title="Interactive Primitive Gallery"
          subtitle="Accessible, keyboard-navigable components crafted with strict design tokens."
        />

        {/* Buttons & Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Panel variant="raised">
            <span className="text-caption text-muted block mb-4 uppercase tracking-label">Buttons</span>
            <div className="flex flex-wrap items-center gap-4">
              <PillButton variant="primary">Primary Ink</PillButton>
              <PillButton variant="light">Light Surface</PillButton>
              <PillButton variant="outline">Outline</PillButton>
              <TextLink href="#">Text Underline Link</TextLink>
              <PillButton variant="primary" onClick={() => setIsSideSheetOpen(true)}>
                Open SideSheet
              </PillButton>
            </div>
          </Panel>

          <Panel variant="raised">
            <span className="text-caption text-muted block mb-4 uppercase tracking-label">Segmented & Text Toggle</span>
            <div className="space-y-4">
              <div>
                <span className="text-[11px] text-muted uppercase tracking-label block mb-1">Text Toggle</span>
                <TextToggle
                  items={[
                    { value: 'day', label: 'Day' },
                    { value: 'week', label: 'Week' },
                    { value: 'month', label: 'Month' },
                  ]}
                  value={toggleVal}
                  onChange={setToggleVal}
                />
              </div>

              <div>
                <span className="text-[11px] text-muted uppercase tracking-label block mb-1">Segmented Pill Control</span>
                <Segmented
                  options={[
                    { value: 'optimised', label: 'Optimised' },
                    { value: 'rule', label: 'Rule-Based' },
                    { value: 'grid', label: 'Grid-Only' },
                  ]}
                  value={segmentedVal}
                  onChange={setSegmentedVal}
                />
              </div>

              <div>
                <span className="text-[11px] text-muted uppercase tracking-label block mb-1">Date Range</span>
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onRangeChange={(s, e) => {
                    setStartDate(s);
                    setEndDate(e);
                  }}
                />
              </div>
            </div>
          </Panel>
        </div>

        {/* Form Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Panel variant="raised">
            <Slider
              label="Battery Capacity"
              value={sliderVal}
              onValueChange={setSliderVal}
              min={2.0}
              max={30.0}
              step={0.5}
              unit="kWh"
            />
          </Panel>

          <Panel variant="raised">
            <NumberInput
              label="Inverter Threshold"
              value={5.0}
              onChange={() => {}}
              unit="kW"
            />
          </Panel>

          <Panel variant="raised">
            <Select
              label="Strategy Mode"
              value={selectVal}
              onValueChange={setSelectVal}
              options={[
                { value: 'optimised_lp', label: 'Optimised (HiGHS LP)' },
                { value: 'rule_based', label: 'Rule-Based Self Consumption' },
                { value: 'grid_only', label: 'Grid-Only Baseline' },
              ]}
            />
          </Panel>
        </div>

        {/* Badges, Tooltips & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Panel variant="raised">
            <span className="text-caption text-muted block mb-4 uppercase tracking-label">Badges & Tooltips</span>
            <div className="flex flex-wrap items-center gap-3">
              <Tooltip content="Clean solar PV production telemetry">
                <Badge variant="solar">Solar Generation</Badge>
              </Tooltip>
              <Tooltip content="Lithium iron phosphate storage state">
                <Badge variant="battery">Battery Active</Badge>
              </Tooltip>
              <Tooltip content="Bidirectional power flow">
                <Badge variant="grid">Grid Interchange</Badge>
              </Tooltip>
              <Tooltip content="Heating, ventilation, and baseload">
                <Badge variant="load">Building Load</Badge>
              </Tooltip>
              <Tooltip content="Residual exceeds 30% threshold flag">
                <Badge variant="fault">Fault Detected</Badge>
              </Tooltip>
              <Badge variant="brass">Optimal Dispatch</Badge>
              <Badge variant="neutral">Status OK</Badge>
            </div>
          </Panel>

          <Panel variant="raised">
            <span className="text-caption text-muted block mb-4 uppercase tracking-label">Compact Stats</span>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Total Solar" value="54.3" unit="kWh" colorAccent="solar" />
              <Stat label="Net Cost" value="₹ 151.2" delta={{ value: '31.4%', positive: true, label: 'saved' }} colorAccent="battery" />
            </div>
          </Panel>
        </div>

        {/* Large Numerals Stagger Preview */}
        <div className="p-8 bg-surface border border-hairline rounded-frame">
          <span className="text-caption text-muted block mb-6 uppercase tracking-label">
            Staggered Display Numerals (Reference Frame 3)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <DisplayNumber
              value={<CountUp to={31.4} decimals={1} />}
              unit="%"
              captionLine1="Savings vs grid-only"
              captionLine2="Optimised LP Dispatch"
            />
            <DisplayNumber
              value={<CountUp to={78.2} decimals={1} />}
              unit="%"
              captionLine1="Self-consumption"
              captionLine2="On-site Solar Used"
            />
            <DisplayNumber
              value={<CountUp to={0.022} decimals={3} />}
              unit="kW"
              captionLine1="Forecast MAE"
              captionLine2="Test Horizon Accuracy"
            />
            <DisplayNumber
              value={<CountUp to={5} />}
              unit="events"
              captionLine1="Anomalies detected"
              captionLine2="Isolation Forest Hybrid"
            />
          </div>
        </div>

        {/* Radix Tabs */}
        <Panel variant="raised">
          <span className="text-caption text-muted block mb-4 uppercase tracking-label">Radix UI Tabs</span>
          <Tabs
            items={[
              {
                value: 'overview',
                label: 'Overview',
                content: (
                  <p className="text-ui text-muted leading-relaxed">
                    Integrated microgrid control combining astronomical clear-sky forecasting, empirical PV thermal derating, and continuous battery state-of-charge tracking.
                  </p>
                ),
              },
              {
                value: 'tariffs',
                label: 'Tariff Schedule',
                content: (
                  <p className="text-ui text-muted leading-relaxed">
                    Time-of-use import pricing: Off-peak ₹6.0 (22:00-06:00), Normal ₹8.0 (06:00-18:00), Peak ₹11.0 (18:00-22:00). Grid export buyback: ₹3.0/kWh.
                  </p>
                ),
              },
              {
                value: 'solver',
                label: 'LP Solver',
                content: (
                  <p className="text-ui text-muted leading-relaxed">
                    Formulated as a linear program and solved globally via SciPy HiGHS simplex solver with strict terminal SoC neutrality.
                  </p>
                ),
              },
            ]}
          />
        </Panel>

        {/* Data Table */}
        <Panel variant="raised">
          <span className="text-caption text-muted block mb-4 uppercase tracking-label">
            Data Table (Sticky Header, Sortable, Tabular Numerals)
          </span>
          <DataTable
            columns={[
              { key: 'period', header: 'Period', sortable: true },
              { key: 'solar', header: 'Solar', align: 'right', sortable: true },
              { key: 'load', header: 'Load', align: 'right', sortable: true },
              { key: 'cost', header: 'Optimised Cost', align: 'right', sortable: true },
              { key: 'savings', header: 'Savings %', align: 'right', sortable: true },
            ]}
            data={sampleTableData}
          />
        </Panel>

        {/* Motion: Reveal & SplitLines */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Panel variant="raised">
            <span className="text-caption text-muted block mb-3 uppercase tracking-label">SplitLines Component</span>
            <SplitLines
              lines={[
                'Autonomous microgrid architecture',
                'Empirically validated with HiGHS',
                'Zero data leakage guaranteed',
              ]}
              lineClassName="font-serif italic text-lg text-ink"
            />
          </Panel>

          <Panel variant="raised">
            <span className="text-caption text-muted block mb-3 uppercase tracking-label">Reveal Component</span>
            <Reveal>
              <div className="p-4 bg-surface border border-hairline rounded-control text-ui text-muted">
                This element rises 24px and fades in using luxury easing (0.22, 1, 0.36, 1) when entering the viewport.
              </div>
            </Reveal>
          </Panel>
        </div>

        {/* Skeleton, EmptyState & ErrorState */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Panel variant="raised">
            <span className="text-caption text-muted block mb-4 uppercase tracking-label">Skeleton Shimmer</span>
            <div className="space-y-3">
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="rectangular" height={80} />
              <Skeleton variant="text" width="40%" />
            </div>
          </Panel>

          <Panel variant="raised">
            <span className="text-caption text-muted block mb-4 uppercase tracking-label">EmptyState</span>
            <EmptyState
              title="No events logged"
              description="No anomaly events detected in the active telemetry window."
            />
          </Panel>

          <Panel variant="raised">
            <span className="text-caption text-muted block mb-4 uppercase tracking-label">ErrorState</span>
            <ErrorState
              title="Connection Timeout"
              message="Failed to establish contact with optimizer kernel."
              onRetry={() => alert('Retry triggered')}
            />
          </Panel>
        </div>

        {/* ECharts Sample Chart */}
        <Panel variant="raised">
          <span className="text-caption text-muted block mb-4 uppercase tracking-label">
            ECharts Theme (Hairline Grid, Inter Muted Labels, Data Colors)
          </span>
          <SampleChart />
        </Panel>
      </section>

      {/* SideSheet Demo */}
      <SideSheet
        open={isSideSheetOpen}
        onOpenChange={setIsSideSheetOpen}
        title="Simulation Parameters"
        description="Configure dispatch strategy, battery capacity, and simulation horizon."
      >
        <div className="space-y-6">
          <Select
            label="Optimization Strategy"
            value={selectVal}
            onValueChange={setSelectVal}
            options={[
              { value: 'optimised_lp', label: 'Optimised (HiGHS LP)' },
              { value: 'rule_based', label: 'Rule-Based Self-Consumption' },
              { value: 'grid_only', label: 'Grid-Only Baseline' },
            ]}
          />
          <Slider
            label="Battery Capacity"
            value={sliderVal}
            onValueChange={setSliderVal}
            min={2.0}
            max={30.0}
            step={0.5}
            unit="kWh"
          />
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onRangeChange={(s, e) => {
              setStartDate(s);
              setEndDate(e);
            }}
          />
          <div className="pt-4 border-t border-hairline">
            <PillButton variant="primary" className="w-full" onClick={() => setIsSideSheetOpen(false)}>
              Apply Changes
            </PillButton>
          </div>
        </div>
      </SideSheet>
    </div>
  );
};

export default DesignPreview;
