import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import '../../lib/echarts-theme';
import { DATA_COLORS } from '../../lib/echarts-theme';
import type { HourlySimPoint, CumulativeCostPoint, FaultEvent } from '../../api/types';

interface ForecastChartProps {
  data: HourlySimPoint[];
  height?: number | string;
}

export const ShowcaseForecastChart: React.FC<ForecastChartProps> = ({ data, height = '100%' }) => {
  const option = useMemo(() => {
    const times = data.map((d) => d.timestamp.slice(11, 16) || d.timestamp);
    const predicted = data.map((d) => d.solar_predicted_kw);
    const actual = data.map((d) => d.solar_actual_kw);

    return {
      animation: true,
      animationDuration: 800,
      tooltip: {
        trigger: 'axis',
      },
      legend: {
        top: 4,
        right: 8,
        data: ['Actual PV', 'Predicted PV'],
        textStyle: { fontSize: 10, color: DATA_COLORS.muted },
      },
      grid: {
        left: '4%',
        right: '4%',
        top: '18%',
        bottom: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: times,
        boundaryGap: false,
        axisLabel: { fontSize: 10, color: DATA_COLORS.muted },
      },
      yAxis: {
        type: 'value',
        name: 'kW',
        nameTextStyle: { fontSize: 10, color: DATA_COLORS.muted },
        splitLine: { lineStyle: { color: DATA_COLORS.hairline } },
      },
      series: [
        {
          name: 'Actual PV',
          type: 'line',
          data: actual,
          smooth: true,
          showSymbol: false,
          itemStyle: { color: DATA_COLORS.solar },
          lineStyle: { width: 2, color: DATA_COLORS.solar },
          areaStyle: { color: 'rgba(217, 148, 30, 0.12)' },
        },
        {
          name: 'Predicted PV',
          type: 'line',
          data: predicted,
          smooth: true,
          showSymbol: false,
          itemStyle: { color: DATA_COLORS.solar },
          lineStyle: { width: 1.5, type: 'dashed', color: DATA_COLORS.forecast },
        },
      ],
    };
  }, [data]);

  return (
    <div
      style={{ height, width: '100%' }}
      role="img"
      aria-label="Solar generation forecast showcase chart comparing actual versus predicted generation"
    >
      <ReactECharts
        option={option}
        theme="helios"
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'svg' }}
        notMerge={true}
      />
    </div>
  );
};

interface FaultChartProps {
  events?: FaultEvent[];
  data: HourlySimPoint[];
  height?: number | string;
}

export const ShowcaseFaultChart: React.FC<FaultChartProps> = ({ events = [], data, height = '100%' }) => {
  // Aggregate events or derive fault hours from data
  const faultPoints = useMemo(() => {
    return data.filter((d) => d.fault_flag);
  }, [data]);

  const option = useMemo(() => {
    const times = data.map((d) => d.timestamp.slice(11, 16) || d.timestamp);
    const actual = data.map((d) => d.solar_actual_kw);
    // Mark fault occurrences on the timeline
    const faultLoss = data.map((d) => (d.fault_flag ? Math.max(0, d.solar_predicted_kw - d.solar_actual_kw) : 0));

    return {
      animation: true,
      animationDuration: 800,
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const list = params as Array<{ dataIndex: number; value: number }>;
          if (!list || list.length === 0) return '';
          const idx = list[0].dataIndex;
          const pt = data[idx];
          if (!pt) return '';
          let text = `<div style="font-size:11px;font-family:sans-serif;padding:2px;">`;
          text += `<strong>${pt.timestamp}</strong><br/>`;
          text += `Actual: ${pt.solar_actual_kw.toFixed(2)} kW | Predicted: ${pt.solar_predicted_kw.toFixed(2)} kW<br/>`;
          if (pt.fault_flag) {
            text += `<span style="color:#C4513F;font-weight:600;">⚠ Fault: ${pt.fault_severity || 'Active'}</span>`;
          } else {
            text += `<span style="color:#3F8F6B;">✓ Normal operation</span>`;
          }
          text += `</div>`;
          return text;
        },
      },
      legend: {
        top: 4,
        right: 8,
        data: ['Output', 'Fault Loss'],
        textStyle: { fontSize: 10, color: DATA_COLORS.muted },
      },
      grid: {
        left: '4%',
        right: '4%',
        top: '18%',
        bottom: '12%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: times,
        boundaryGap: false,
        axisLabel: { fontSize: 10, color: DATA_COLORS.muted },
      },
      yAxis: {
        type: 'value',
        name: 'kW',
        nameTextStyle: { fontSize: 10, color: DATA_COLORS.muted },
        splitLine: { lineStyle: { color: DATA_COLORS.hairline } },
      },
      series: [
        {
          name: 'Output',
          type: 'line',
          data: actual,
          smooth: true,
          showSymbol: false,
          itemStyle: { color: DATA_COLORS.solar },
          lineStyle: { width: 2, color: DATA_COLORS.solar },
        },
        {
          name: 'Fault Loss',
          type: 'bar',
          data: faultLoss,
          itemStyle: { color: 'rgba(196, 81, 63, 0.75)' },
          barMaxWidth: 8,
        },
      ],
    };
  }, [data]);

  return (
    <div
      style={{ height }}
      className="w-full flex flex-col justify-between"
      role="img"
      aria-label="Fault detection timeline strip and generation residual loss showcase chart"
    >
      {/* Timeline Event Strip at the top */}
      <div className="w-full pb-2 mb-1 border-b border-hairline/60 flex items-center justify-between text-[11px] text-muted">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-fault inline-block animate-pulse" />
          <span className="font-sans font-medium text-ink">
            {faultPoints.length === 1 ? '1 event' : `${faultPoints.length} events`}
          </span>
          <span className="text-muted">detected on timeline</span>
        </div>
        <div className="text-[10px] text-muted font-mono">
          {events.length > 0 ? `${events.length} logged incidents` : 'Dual-method hybrid'}
        </div>
      </div>

      {/* Discrete Timeline Strip of Event Blocks */}
      <div className="w-full h-3 bg-surface border border-hairline/60 rounded-sm mb-2 flex overflow-hidden">
        {data.length > 0 ? (
          data.map((pt, idx) => (
            <div
              key={idx}
              title={`${pt.timestamp}: ${pt.fault_flag ? pt.fault_severity || 'Fault' : 'Normal'}`}
              className={`h-full flex-grow ${
                pt.fault_flag ? 'bg-fault' : 'bg-transparent'
              }`}
              style={{ minWidth: `${100 / Math.max(1, data.length)}%` }}
            />
          ))
        ) : (
          <div className="w-full h-full bg-muted/10" />
        )}
      </div>

      {/* Main ECharts Chart */}
      <div className="flex-grow w-full min-h-[140px]">
        <ReactECharts
          option={option}
          theme="helios"
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'svg' }}
          notMerge={true}
        />
      </div>
    </div>
  );
};

interface CostChartProps {
  data: CumulativeCostPoint[];
  height?: number | string;
}

export const ShowcaseCostChart: React.FC<CostChartProps> = ({ data, height = '100%' }) => {
  const option = useMemo(() => {
    const times = data.map((d) => d.timestamp.slice(5, 16) || d.timestamp);
    const gridOnly = data.map((d) => d.grid_only);
    const ruleBased = data.map((d) => d.rule_based);
    const optimised = data.map((d) => d.optimised_lp);

    return {
      animation: true,
      animationDuration: 800,
      tooltip: {
        trigger: 'axis',
      },
      legend: {
        top: 4,
        right: 8,
        data: ['Grid Baseline', 'Rule-Based', 'Optimised LP'],
        textStyle: { fontSize: 10, color: DATA_COLORS.muted },
      },
      grid: {
        left: '4%',
        right: '4%',
        top: '18%',
        bottom: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: times,
        boundaryGap: false,
        axisLabel: { fontSize: 10, color: DATA_COLORS.muted },
      },
      yAxis: {
        type: 'value',
        name: '₹ Total Cost',
        nameTextStyle: { fontSize: 10, color: DATA_COLORS.muted },
        splitLine: { lineStyle: { color: DATA_COLORS.hairline } },
      },
      series: [
        {
          name: 'Grid Baseline',
          type: 'line',
          data: gridOnly,
          smooth: true,
          showSymbol: false,
          itemStyle: { color: DATA_COLORS.grid },
          lineStyle: { width: 1.5, type: 'dashed', color: DATA_COLORS.grid },
        },
        {
          name: 'Rule-Based',
          type: 'line',
          data: ruleBased,
          smooth: true,
          showSymbol: false,
          itemStyle: { color: DATA_COLORS.load },
          lineStyle: { width: 1.5, color: DATA_COLORS.load },
        },
        {
          name: 'Optimised LP',
          type: 'line',
          data: optimised,
          smooth: true,
          showSymbol: false,
          itemStyle: { color: DATA_COLORS.battery },
          lineStyle: { width: 2.5, color: DATA_COLORS.battery },
          areaStyle: { color: 'rgba(63, 143, 107, 0.12)' },
        },
      ],
    };
  }, [data]);

  return (
    <div
      style={{ height, width: '100%' }}
      role="img"
      aria-label="Cost comparison showcase chart showing cumulative electricity savings with battery storage"
    >
      <ReactECharts
        option={option}
        theme="helios"
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'svg' }}
        notMerge={true}
      />
    </div>
  );
};

interface BatterySocChartProps {
  data: HourlySimPoint[];
  height?: number | string;
}

export const BatterySocChart: React.FC<BatterySocChartProps> = ({ data, height = 340 }) => {
  const option = useMemo(() => {
    const times = data.map((d) => d.timestamp.slice(11, 16) || d.timestamp);
    const soc = data.map((d) => d.soc_pct);
    const charge = data.map((d) => d.battery_charge_kw);
    const discharge = data.map((d) => -d.battery_discharge_kw);

    return {
      animation: true,
      animationDuration: 800,
      tooltip: {
        trigger: 'axis',
      },
      legend: {
        top: 6,
        right: 12,
        data: ['State of Charge (%)', 'Charge (kW)', 'Discharge (kW)'],
        textStyle: { fontSize: 11, color: DATA_COLORS.muted },
      },
      grid: {
        left: '3%',
        right: '4%',
        top: '16%',
        bottom: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: times,
        boundaryGap: false,
        axisLabel: { fontSize: 11, color: DATA_COLORS.muted },
      },
      yAxis: [
        {
          type: 'value',
          name: 'SoC %',
          min: 0,
          max: 100,
          nameTextStyle: { fontSize: 11, color: DATA_COLORS.muted },
          splitLine: { lineStyle: { color: DATA_COLORS.hairline } },
        },
        {
          type: 'value',
          name: 'Power (kW)',
          nameTextStyle: { fontSize: 11, color: DATA_COLORS.muted },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: 'State of Charge (%)',
          type: 'line',
          yAxisIndex: 0,
          data: soc,
          smooth: true,
          showSymbol: false,
          itemStyle: { color: DATA_COLORS.battery },
          lineStyle: { width: 2.5, color: DATA_COLORS.battery },
          areaStyle: { color: 'rgba(63, 143, 107, 0.15)' },
        },
        {
          name: 'Charge (kW)',
          type: 'bar',
          yAxisIndex: 1,
          data: charge,
          itemStyle: { color: 'rgba(63, 143, 107, 0.4)' },
        },
        {
          name: 'Discharge (kW)',
          type: 'bar',
          yAxisIndex: 1,
          data: discharge,
          itemStyle: { color: 'rgba(196, 81, 63, 0.4)' },
        },
      ],
    };
  }, [data]);

  return (
    <div
      style={{ height, width: '100%' }}
      role="img"
      aria-label="Battery state of charge percentage and storage power flow profile"
    >
      <ReactECharts
        option={option}
        theme="helios"
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'svg' }}
        notMerge={true}
      />
    </div>
  );
};

