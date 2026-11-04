import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import '../../lib/echarts-theme';
import { DATA_COLORS } from '../../lib/echarts-theme';
import type { CumulativeCostPoint, HourlySimPoint, PeriodSummaryItem } from '../../api/types';

// ============================================================================
// 1. CUMULATIVE COST CHART (Three lines: Grid-only, Rule-based, Optimised)
// ============================================================================
interface CumulativeCostChartProps {
  data: CumulativeCostPoint[];
  height?: number | string;
  chartRef?: React.RefObject<ReactECharts>;
}

export const CumulativeCostChart: React.FC<CumulativeCostChartProps> = ({
  data,
  height = 420,
  chartRef,
}) => {
  const option = useMemo(() => {
    const times = data.map((d) => d.timestamp.slice(5, 16) || d.timestamp);
    const gridOnly = data.map((d) => Number(d.grid_only.toFixed(2)));
    const ruleBased = data.map((d) => Number(d.rule_based.toFixed(2)));
    const optimised = data.map((d) => Number(d.optimised_lp.toFixed(2)));

    return {
      animation: false,
      animationDurationUpdate: 0,
      grid: {
        left: '4%',
        right: '4%',
        top: '12%',
        bottom: '10%',
        containLabel: true,
      },
      legend: {
        top: 6,
        right: 12,
        data: ['Grid-only Baseline', 'Rule-based Self-consumption', 'Optimised Linear Program'],
        textStyle: { fontSize: 11, color: DATA_COLORS.muted },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          lineStyle: { color: DATA_COLORS.hairline, type: 'dashed' },
        },
        backgroundColor: '#FFFFFF',
        borderColor: DATA_COLORS.hairline,
        textStyle: { color: '#1B1F1D', fontSize: 11 },
        formatter: (params: unknown) => {
          const list = params as Array<{
            seriesName: string;
            value: number;
            dataIndex: number;
            color: string;
          }>;
          if (!list || list.length === 0) return '';
          const idx = list[0].dataIndex;
          const pt = data[idx];
          if (!pt) return '';

          const savingsOpt = Math.max(0, pt.grid_only - pt.optimised_lp);
          const savingsPct = pt.grid_only > 0 ? (savingsOpt / pt.grid_only) * 100 : 0;

          return `
            <div style="font-family:sans-serif;padding:3px 2px;min-width:200px;">
              <div style="font-weight:600;margin-bottom:6px;color:#1B1F1D;">${pt.timestamp}</div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
                <span style="color:${DATA_COLORS.grid};">Grid-Only Baseline:</span>
                <span style="font-weight:500;">₹ ${pt.grid_only.toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
                <span style="color:${DATA_COLORS.solar};">Rule-Based Dispatch:</span>
                <span style="font-weight:500;">₹ ${pt.rule_based.toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:4px;">
                <span style="color:${DATA_COLORS.battery};font-weight:600;">● Optimised LP:</span>
                <span style="font-weight:600;color:${DATA_COLORS.battery};">₹ ${pt.optimised_lp.toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-top:6px;padding-top:6px;border-top:1px solid #E4DDD0;">
                <span style="color:${DATA_COLORS.muted};">Optimised Savings:</span>
                <span style="font-weight:600;color:${DATA_COLORS.battery};">₹ ${savingsOpt.toFixed(2)} (-${savingsPct.toFixed(1)}%)</span>
              </div>
            </div>
          `;
        },
      },
      xAxis: {
        type: 'category',
        data: times,
        boundaryGap: false,
        axisLine: { lineStyle: { color: DATA_COLORS.hairline } },
        axisLabel: {
          color: DATA_COLORS.muted,
          fontSize: 10,
          interval: Math.max(1, Math.floor(times.length / 10)),
        },
      },
      yAxis: {
        type: 'value',
        name: 'Cumulative Cost (₹)',
        nameTextStyle: { color: DATA_COLORS.muted, fontSize: 11 },
        axisLabel: {
          formatter: '₹ {value}',
          color: DATA_COLORS.muted,
          fontSize: 10,
        },
        splitLine: {
          lineStyle: { color: DATA_COLORS.hairline, type: 'dashed' },
        },
      },
      series: [
        // 1. Grid-only
        {
          name: 'Grid-only Baseline',
          type: 'line',
          data: gridOnly,
          sampling: 'lttb',
          showSymbol: false,
          itemStyle: { color: DATA_COLORS.grid },
          lineStyle: { width: 1.8, type: 'dashed', color: DATA_COLORS.grid },
        },
        // 2. Rule-based
        {
          name: 'Rule-based Self-consumption',
          type: 'line',
          data: ruleBased,
          sampling: 'lttb',
          showSymbol: false,
          itemStyle: { color: DATA_COLORS.solar },
          lineStyle: { width: 2, color: DATA_COLORS.solar },
        },
        // 3. Optimised LP
        {
          name: 'Optimised Linear Program',
          type: 'line',
          data: optimised,
          sampling: 'lttb',
          showSymbol: false,
          itemStyle: { color: DATA_COLORS.battery },
          lineStyle: { width: 2.5, color: DATA_COLORS.battery },
          areaStyle: {
            color: 'rgba(63, 143, 107, 0.08)',
          },
        },
      ],
    };
  }, [data]);

  return (
    <div
      style={{ height, width: '100%' }}
      role="img"
      aria-label="Cumulative electricity expenditure comparison between Grid-Only, Rule-Based, and Optimised LP dispatch over the selected horizon"
    >
      <ReactECharts
        ref={chartRef}
        option={option}
        theme="helios"
        style={{ height: '100%', width: '100%' }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
};

// ============================================================================
// 2. TARIFF ARBITRAGE CHART (Time-of-Use Step Line + Average Storage Dispatch)
// ============================================================================
interface TariffArbitrageChartProps {
  hourlySimData: HourlySimPoint[];
  height?: number | string;
  chartRef?: React.RefObject<ReactECharts>;
}

export const TariffArbitrageChart: React.FC<TariffArbitrageChartProps> = ({
  hourlySimData,
  height = 420,
  chartRef,
}) => {
  const option = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

    // Standard time-of-use tariff rates:
    // Off-peak: 22:00 to 06:00 (₹ 6.00)
    // Normal: 06:00 to 18:00 (₹ 8.00)
    // Peak: 18:00 to 22:00 (₹ 11.00)
    const tariffStepPrices = [
      6, 6, 6, 6, 6, 6, // 00 to 05
      8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, // 06 to 17
      11, 11, 11, 11, // 18 to 21
      6, 6, // 22 to 23
    ];

    // Compute average charge and discharge per hour across the selected range
    const hourCounts = new Array(24).fill(0);
    const chargeSums = new Array(24).fill(0);
    const dischargeSums = new Array(24).fill(0);

    hourlySimData.forEach((pt) => {
      const hr = parseInt(pt.timestamp.slice(11, 13), 10);
      if (!isNaN(hr) && hr >= 0 && hr < 24) {
        hourCounts[hr] += 1;
        chargeSums[hr] += pt.battery_charge_kw;
        dischargeSums[hr] += pt.battery_discharge_kw;
      }
    });

    const avgCharge = hours.map((_, h) => {
      const cnt = hourCounts[h] || 1;
      return Number((chargeSums[h] / cnt).toFixed(2));
    });

    const avgDischarge = hours.map((_, h) => {
      const cnt = hourCounts[h] || 1;
      return Number((dischargeSums[h] / cnt).toFixed(2));
    });

    const maxPower = Math.max(1, ...avgCharge, ...avgDischarge);
    const powerAxisBound = Math.ceil(maxPower * 1.25) || 5;

    return {
      animation: false,
      animationDurationUpdate: 0,
      grid: {
        left: '4%',
        right: '5%',
        top: '14%',
        bottom: '10%',
        containLabel: true,
      },
      legend: {
        top: 6,
        right: 12,
        data: ['Electricity Tariff (₹/kWh)', 'Average Battery Charge (kW)', 'Average Battery Discharge (kW)'],
        textStyle: { fontSize: 11, color: DATA_COLORS.muted },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          lineStyle: { color: DATA_COLORS.hairline, type: 'dashed' },
        },
        backgroundColor: '#FFFFFF',
        borderColor: DATA_COLORS.hairline,
        textStyle: { color: '#1B1F1D', fontSize: 11 },
        formatter: (params: unknown) => {
          const list = params as Array<{
            seriesName: string;
            value: number;
            dataIndex: number;
            color: string;
          }>;
          if (!list || list.length === 0) return '';
          const idx = list[0].dataIndex;
          const hrStr = hours[idx];
          const price = tariffStepPrices[idx];
          const ch = avgCharge[idx];
          const dis = avgDischarge[idx];

          let periodLabel = 'Off-Peak (Low Tariff)';
          if (idx >= 6 && idx < 18) periodLabel = 'Normal Daylight (Moderate Tariff)';
          else if (idx >= 18 && idx < 22) periodLabel = 'Evening Peak (High Tariff)';

          return `
            <div style="font-family:sans-serif;padding:3px 2px;min-width:210px;">
              <div style="font-weight:600;margin-bottom:4px;color:#1B1F1D;">${hrStr} · ${periodLabel}</div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
                <span style="color:${DATA_COLORS.grid};font-weight:500;">Tariff Rate:</span>
                <span style="font-weight:600;">₹ ${price.toFixed(2)} / kWh</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
                <span style="color:${DATA_COLORS.battery};">● Avg Battery Charge:</span>
                <span style="font-weight:500;">${ch.toFixed(2)} kW</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:4px;">
                <span style="color:${DATA_COLORS.solar};">● Avg Battery Discharge:</span>
                <span style="font-weight:500;">${dis.toFixed(2)} kW</span>
              </div>
              <div style="margin-top:4px;padding-top:4px;border-top:1px solid #E4DDD0;font-size:10px;color:${DATA_COLORS.muted};">
                ${
                  idx >= 18 && idx < 22
                    ? 'Arbitrage: Battery discharges to eliminate peak grid import.'
                    : idx >= 10 && idx < 16
                    ? 'Solar Absorption: Battery charges from surplus solar generation.'
                    : idx < 6
                    ? 'Off-Peak Balancing: Grid charges battery during low tariff hours if needed.'
                    : 'Balanced Dispatch.'
                }
              </div>
            </div>
          `;
        },
      },
      xAxis: {
        type: 'category',
        data: hours,
        boundaryGap: true,
        axisLine: { lineStyle: { color: DATA_COLORS.hairline } },
        axisLabel: {
          color: DATA_COLORS.muted,
          fontSize: 10,
          interval: 2, // Every 3 hours (00:00, 03:00, 06:00...)
        },
      },
      yAxis: [
        // Left Axis: Tariff Rate (₹/kWh)
        {
          type: 'value',
          name: 'Tariff (₹/kWh)',
          nameTextStyle: { color: DATA_COLORS.muted, fontSize: 11 },
          min: 0,
          max: 14,
          interval: 2,
          axisLabel: {
            formatter: '₹ {value}',
            color: DATA_COLORS.muted,
            fontSize: 10,
          },
          splitLine: {
            lineStyle: { color: DATA_COLORS.hairline, type: 'dashed' },
          },
        },
        // Right Axis: Battery Power (kW)
        {
          type: 'value',
          name: 'Avg Dispatch (kW)',
          nameTextStyle: { color: DATA_COLORS.muted, fontSize: 11 },
          min: 0,
          max: powerAxisBound,
          axisLabel: {
            formatter: '{value} kW',
            color: DATA_COLORS.muted,
            fontSize: 10,
          },
          splitLine: { show: false },
        },
      ],
      series: [
        // 1. Time-of-Use Tariff Step Line with markArea Bands
        {
          name: 'Electricity Tariff (₹/kWh)',
          type: 'line',
          step: 'end',
          yAxisIndex: 0,
          data: tariffStepPrices,
          itemStyle: { color: DATA_COLORS.grid },
          lineStyle: { width: 2.4, color: DATA_COLORS.grid },
          showSymbol: false,
          markArea: {
            silent: true,
            data: [
              // Off-peak overnight (00:00 to 06:00)
              [
                {
                  name: 'Off-Peak (₹ 6)',
                  xAxis: '00:00',
                  itemStyle: { color: 'rgba(63, 143, 107, 0.07)' },
                  label: { color: DATA_COLORS.muted, fontSize: 10, position: 'insideTopLeft' },
                },
                { xAxis: '06:00' },
              ],
              // Normal daylight (06:00 to 18:00)
              [
                {
                  name: 'Normal (₹ 8)',
                  xAxis: '06:00',
                  itemStyle: { color: 'rgba(217, 148, 30, 0.05)' },
                  label: { color: DATA_COLORS.muted, fontSize: 10, position: 'insideTopLeft' },
                },
                { xAxis: '18:00' },
              ],
              // Evening peak (18:00 to 22:00)
              [
                {
                  name: 'Peak (₹ 11)',
                  xAxis: '18:00',
                  itemStyle: { color: 'rgba(196, 81, 63, 0.08)' },
                  label: { color: DATA_COLORS.fault, fontSize: 10, position: 'insideTopLeft' },
                },
                { xAxis: '22:00' },
              ],
              // Off-peak night (22:00 to 23:00)
              [
                {
                  name: 'Off-Peak (₹ 6)',
                  xAxis: '22:00',
                  itemStyle: { color: 'rgba(63, 143, 107, 0.07)' },
                  label: { color: DATA_COLORS.muted, fontSize: 10, position: 'insideTopLeft' },
                },
                { xAxis: '23:00' },
              ],
            ],
          },
        },
        // 2. Average Battery Charge Power (kW)
        {
          name: 'Average Battery Charge (kW)',
          type: 'bar',
          yAxisIndex: 1,
          data: avgCharge,
          itemStyle: {
            color: 'rgba(63, 143, 107, 0.75)',
            borderRadius: [2, 2, 0, 0],
          },
          barMaxWidth: 16,
        },
        // 3. Average Battery Discharge Power (kW)
        {
          name: 'Average Battery Discharge (kW)',
          type: 'bar',
          yAxisIndex: 1,
          data: avgDischarge,
          itemStyle: {
            color: 'rgba(217, 148, 30, 0.85)',
            borderRadius: [2, 2, 0, 0],
          },
          barMaxWidth: 16,
        },
      ],
    };
  }, [hourlySimData]);

  return (
    <div
      style={{ height, width: '100%' }}
      role="img"
      aria-label="Hourly time-of-use tariff rate step line overlaid with average battery charging and discharging schedules"
    >
      <ReactECharts
        ref={chartRef}
        option={option}
        theme="helios"
        style={{ height: '100%', width: '100%' }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
};

// ============================================================================
// 3. MONTHLY SAVINGS BAR CHART (from /api/period-summary)
// ============================================================================
interface MonthlySavingsBarChartProps {
  periods: PeriodSummaryItem[];
  height?: number | string;
  chartRef?: React.RefObject<ReactECharts>;
}

export const MonthlySavingsBarChart: React.FC<MonthlySavingsBarChartProps> = ({
  periods,
  height = 380,
  chartRef,
}) => {
  const option = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const months = periods.map((p) => {
      const mIdx = parseInt(p.period.slice(5, 7), 10) - 1;
      return monthNames[mIdx] || p.period;
    });

    const savingsAmounts = periods.map((p) => Number(p.savings_amount.toFixed(2)));
    const savingsPcts = periods.map((p) => Number(p.savings_percent.toFixed(1)));

    return {
      animation: false,
      animationDurationUpdate: 0,
      grid: {
        left: '4%',
        right: '4%',
        top: '14%',
        bottom: '10%',
        containLabel: true,
      },
      legend: {
        top: 6,
        right: 12,
        data: ['Optimised Savings (₹)', 'Savings Percentage (%)'],
        textStyle: { fontSize: 11, color: DATA_COLORS.muted },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        backgroundColor: '#FFFFFF',
        borderColor: DATA_COLORS.hairline,
        textStyle: { color: '#1B1F1D', fontSize: 11 },
        formatter: (params: unknown) => {
          const list = params as Array<{
            seriesName: string;
            value: number;
            dataIndex: number;
          }>;
          if (!list || list.length === 0) return '';
          const idx = list[0].dataIndex;
          const p = periods[idx];
          if (!p) return '';

          return `
            <div style="font-family:sans-serif;padding:3px 2px;min-width:190px;">
              <div style="font-weight:600;margin-bottom:6px;color:#1B1F1D;">${months[idx]} (${p.period})</div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
                <span style="color:${DATA_COLORS.grid};">Grid-Only Cost:</span>
                <span>₹ ${p.grid_only_cost.toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
                <span style="color:${DATA_COLORS.ink};">Optimised Cost:</span>
                <span>₹ ${p.optimised_cost.toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-top:6px;padding-top:6px;border-top:1px solid #E4DDD0;">
                <span style="color:${DATA_COLORS.battery};font-weight:600;">Monthly Savings:</span>
                <span style="font-weight:600;color:${DATA_COLORS.battery};">₹ ${p.savings_amount.toFixed(2)} (-${p.savings_percent.toFixed(1)}%)</span>
              </div>
            </div>
          `;
        },
      },
      xAxis: {
        type: 'category',
        data: months,
        axisLine: { lineStyle: { color: DATA_COLORS.hairline } },
        axisLabel: { color: DATA_COLORS.muted, fontSize: 11 },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Savings (₹)',
          nameTextStyle: { color: DATA_COLORS.muted, fontSize: 11 },
          axisLabel: {
            formatter: '₹ {value}',
            color: DATA_COLORS.muted,
            fontSize: 10,
          },
          splitLine: {
            lineStyle: { color: DATA_COLORS.hairline, type: 'dashed' },
          },
        },
        {
          type: 'value',
          name: 'Savings (%)',
          nameTextStyle: { color: DATA_COLORS.muted, fontSize: 11 },
          min: 0,
          max: 100,
          interval: 25,
          axisLabel: {
            formatter: '{value}%',
            color: DATA_COLORS.muted,
            fontSize: 10,
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: 'Optimised Savings (₹)',
          type: 'bar',
          yAxisIndex: 0,
          data: savingsAmounts,
          itemStyle: {
            color: DATA_COLORS.battery,
            borderRadius: [3, 3, 0, 0],
          },
          barMaxWidth: 28,
        },
        {
          name: 'Savings Percentage (%)',
          type: 'line',
          yAxisIndex: 1,
          data: savingsPcts,
          showSymbol: true,
          symbolSize: 6,
          itemStyle: { color: DATA_COLORS.solar },
          lineStyle: { width: 2, color: DATA_COLORS.solar },
        },
      ],
    };
  }, [periods]);

  return (
    <div
      style={{ height, width: '100%' }}
      role="img"
      aria-label="Monthly electricity cost savings breakdown and solar self-consumption for the selected year"
    >
      <ReactECharts
        ref={chartRef}
        option={option}
        theme="helios"
        style={{ height: '100%', width: '100%' }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
};
