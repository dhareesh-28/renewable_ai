import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import '../../lib/echarts-theme';
import { DATA_COLORS } from '../../lib/echarts-theme';
import type { HourlySimPoint } from '../../api/types';

// ============================================================================
// 1. STATE OF CHARGE CHART (Dual Axis: SoC % & Charge/Discharge kW)
// ============================================================================
interface StateOfChargeChartProps {
  data: HourlySimPoint[];
  batteryKwh: number;
  batteryKw: number;
  height?: number | string;
  chartRef?: React.RefObject<ReactECharts>;
}

export const StateOfChargeChart: React.FC<StateOfChargeChartProps> = ({
  data,
  batteryKw,
  height = 420,
  chartRef,
}) => {
  const option = useMemo(() => {
    const times = data.map((d) => d.timestamp.slice(5, 16) || d.timestamp);
    const socValues = data.map((d) => Number(d.soc_pct.toFixed(1)));
    const chargeValues = data.map((d) => Number(d.battery_charge_kw.toFixed(2)));
    const dischargeValues = data.map((d) => Number((-d.battery_discharge_kw).toFixed(2)));

    const maxKw = Math.max(
      batteryKw,
      ...data.map((d) => Math.max(d.battery_charge_kw, d.battery_discharge_kw))
    );
    const powerAxisBound = Math.ceil(maxKw * 1.15) || 5;

    return {
      animation: false,
      animationDurationUpdate: 0,
      grid: {
        left: '4%',
        right: '5%',
        top: '12%',
        bottom: '10%',
        containLabel: true,
      },
      legend: {
        top: 6,
        right: 12,
        data: ['State of Charge (%)', 'Charge Power (kW)', 'Discharge Power (kW)'],
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

          const netKw = pt.battery_charge_kw - pt.battery_discharge_kw;
          const netLabel =
            netKw > 0
              ? `+${netKw.toFixed(2)} kW (Charging)`
              : netKw < 0
                ? `${netKw.toFixed(2)} kW (Discharging)`
                : 'Idle';

          return `
            <div style="font-family:sans-serif;padding:3px 2px;min-width:180px;">
              <div style="font-weight:600;margin-bottom:6px;color:#1B1F1D;">${pt.timestamp}</div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
                <span style="color:${DATA_COLORS.battery};font-weight:500;">● State of Charge:</span>
                <span style="font-weight:600;">${pt.soc_pct.toFixed(1)}%</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
                <span style="color:${DATA_COLORS.battery};">● Charge Power:</span>
                <span>${pt.battery_charge_kw.toFixed(2)} kW</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
                <span style="color:${DATA_COLORS.solar};">● Discharge Power:</span>
                <span>${pt.battery_discharge_kw.toFixed(2)} kW</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-top:6px;padding-top:6px;border-top:1px solid #E4DDD0;">
                <span style="color:${DATA_COLORS.muted};">Net Storage Flow:</span>
                <span style="font-weight:500;">${netLabel}</span>
              </div>
            </div>
          `;
        },
      },
      xAxis: {
        type: 'category',
        data: times,
        boundaryGap: true,
        axisLine: { lineStyle: { color: DATA_COLORS.hairline } },
        axisLabel: {
          color: DATA_COLORS.muted,
          fontSize: 10,
          interval: Math.max(1, Math.floor(times.length / 10)),
        },
      },
      yAxis: [
        // Left Axis: State of Charge (%)
        {
          type: 'value',
          name: 'State of Charge (%)',
          nameTextStyle: { color: DATA_COLORS.muted, fontSize: 11 },
          min: 0,
          max: 100,
          interval: 25,
          axisLabel: {
            formatter: '{value}%',
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
          name: 'Power (kW)',
          nameTextStyle: { color: DATA_COLORS.muted, fontSize: 11 },
          min: -powerAxisBound,
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
        // 1. SoC % Line with Reference Limit markLines
        {
          name: 'State of Charge (%)',
          type: 'line',
          yAxisIndex: 0,
          data: socValues,
          sampling: 'lttb',
          smooth: true,
          showSymbol: false,
          itemStyle: { color: DATA_COLORS.battery },
          lineStyle: { width: 2.2, color: DATA_COLORS.battery },
          areaStyle: {
            color: 'rgba(63, 143, 107, 0.12)',
          },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              {
                yAxis: 10,
                name: 'Min Limit (10%)',
                lineStyle: { color: DATA_COLORS.fault, type: 'dashed', width: 1.2 },
                label: {
                  formatter: 'Min 10%',
                  position: 'insideStartBottom',
                  color: DATA_COLORS.fault,
                  fontSize: 10,
                },
              },
              {
                yAxis: 100,
                name: 'Max Limit (100%)',
                lineStyle: { color: DATA_COLORS.battery, type: 'dashed', width: 1.2 },
                label: {
                  formatter: 'Max 100%',
                  position: 'insideStartTop',
                  color: DATA_COLORS.battery,
                  fontSize: 10,
                },
              },
            ],
          },
        },
        // 2. Charge Power (kW) - Positive bars
        {
          name: 'Charge Power (kW)',
          type: 'bar',
          yAxisIndex: 1,
          data: chargeValues,
          itemStyle: {
            color: 'rgba(63, 143, 107, 0.75)',
            borderRadius: [2, 2, 0, 0],
          },
          barMaxWidth: 16,
        },
        // 3. Discharge Power (kW) - Negative bars
        {
          name: 'Discharge Power (kW)',
          type: 'bar',
          yAxisIndex: 1,
          data: dischargeValues,
          itemStyle: {
            color: 'rgba(217, 148, 30, 0.85)',
            borderRadius: [0, 0, 2, 2],
          },
          barMaxWidth: 16,
        },
      ],
    };
  }, [data, batteryKw]);

  return (
    <div
      style={{ height, width: '100%' }}
      role="img"
      aria-label="Battery state of charge percentage and bidirectional power charging and discharging profile over the horizon"
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
// 2. ENERGY FLOW SANKEY CHART (Solar/Grid/Battery/Load Balancing)
// ============================================================================
interface EnergyFlowSankeyChartProps {
  data: HourlySimPoint[];
  height?: number | string;
  chartRef?: React.RefObject<ReactECharts>;
}

export const EnergyFlowSankeyChart: React.FC<EnergyFlowSankeyChartProps> = ({
  data,
  height = 460,
  chartRef,
}) => {
  const { nodes, links } = useMemo(() => {
    let solar_to_load = 0;
    let solar_to_batt = 0;
    let solar_to_export = 0;
    let batt_to_load = 0;
    let grid_to_load = 0;
    let grid_to_batt = 0;
    let total_load = 0;
    let total_solar = 0;
    let total_import = 0;

    data.forEach((h) => {
      const s = h.solar_actual_kw;
      const l = h.load_kw;
      const ch = h.battery_charge_kw;
      const dis = h.battery_discharge_kw;
      const imp = h.grid_import_kw;

      total_solar += s;
      total_load += l;
      total_import += imp;

      // Solar distribution: direct to load, then battery, then export
      const s_to_l = Math.min(s, l);
      const s_rem = Math.max(0, s - s_to_l);
      const s_to_b = Math.min(s_rem, ch);
      const s_to_exp = Math.max(0, s - s_to_l - s_to_b);

      solar_to_load += s_to_l;
      solar_to_batt += s_to_b;
      solar_to_export += s_to_exp;

      // Battery discharge to load
      batt_to_load += dis;

      // Grid import: to battery if solar was insufficient, remainder to load
      const g_to_b = Math.max(0, ch - s_to_b);
      const g_to_l = Math.max(0, imp - g_to_b);

      grid_to_batt += g_to_b;
      grid_to_load += g_to_l;
    });

    const sankeyNodes = [
      { name: 'Solar Generation', itemStyle: { color: DATA_COLORS.solar } },
      { name: 'Grid Import', itemStyle: { color: DATA_COLORS.grid } },
      { name: 'Battery Storage', itemStyle: { color: DATA_COLORS.battery } },
      { name: 'Building Load', itemStyle: { color: DATA_COLORS.load } },
      { name: 'Grid Export', itemStyle: { color: '#7B9AA8' } },
    ];

    const rawLinks = [
      { source: 'Solar Generation', target: 'Building Load', value: Number(solar_to_load.toFixed(2)) },
      { source: 'Solar Generation', target: 'Battery Storage', value: Number(solar_to_batt.toFixed(2)) },
      { source: 'Solar Generation', target: 'Grid Export', value: Number(solar_to_export.toFixed(2)) },
      { source: 'Battery Storage', target: 'Building Load', value: Number(batt_to_load.toFixed(2)) },
      { source: 'Grid Import', target: 'Building Load', value: Number(grid_to_load.toFixed(2)) },
      { source: 'Grid Import', target: 'Battery Storage', value: Number(grid_to_batt.toFixed(2)) },
    ];

    // Filter out negligible flows (< 0.01 kWh) to prevent rendering artefacts
    const sankeyLinks = rawLinks.filter((l) => l.value > 0.01);

    return {
      nodes: sankeyNodes,
      links: sankeyLinks,
      balances: {
        solar: total_solar,
        load: total_load,
        import: total_import,
        solarToLoad: solar_to_load,
        solarToBatt: solar_to_batt,
        solarToExport: solar_to_export,
        battToLoad: batt_to_load,
        gridToLoad: grid_to_load,
        gridToBatt: grid_to_batt,
      },
    };
  }, [data]);

  const option = useMemo(() => {
    return {
      animation: false,
      animationDurationUpdate: 0,
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        backgroundColor: '#FFFFFF',
        borderColor: DATA_COLORS.hairline,
        textStyle: { color: '#1B1F1D', fontSize: 11 },
        formatter: (params: unknown) => {
          const item = params as {
            dataType: 'node' | 'edge';
            name: string;
            value: number;
            data: { source?: string; target?: string; value: number };
          };

          if (item.dataType === 'edge') {
            return `
              <div style="font-family:sans-serif;padding:3px 2px;">
                <div style="font-weight:600;color:#1B1F1D;margin-bottom:3px;">
                  ${item.data.source} → ${item.data.target}
                </div>
                <div style="font-size:13px;font-family:serif;font-weight:600;color:${DATA_COLORS.ink};">
                  ${item.data.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh
                </div>
              </div>
            `;
          }

          return `
            <div style="font-family:sans-serif;padding:3px 2px;">
              <div style="font-weight:600;color:#1B1F1D;margin-bottom:2px;">${item.name}</div>
              <div style="font-size:12px;color:${DATA_COLORS.muted};">
                Nodal Aggregate: <b>${item.value ? item.value.toFixed(2) : ''} kWh</b>
              </div>
            </div>
          `;
        },
      },
      series: [
        {
          type: 'sankey',
          layout: 'none',
          emphasis: { focus: 'adjacency' },
          data: nodes,
          links: links,
          top: '8%',
          bottom: '8%',
          left: '6%',
          right: '10%',
          nodeWidth: 18,
          nodeGap: 28,
          draggable: false,
          label: {
            position: 'right',
            color: DATA_COLORS.ink,
            fontSize: 11,
            fontFamily: '"Inter Variable", sans-serif',
            formatter: '{b}',
          },
          lineStyle: {
            color: 'gradient',
            curveness: 0.5,
            opacity: 0.38,
          },
        },
      ],
    };
  }, [nodes, links]);

  return (
    <div
      style={{ height, width: '100%' }}
      role="img"
      aria-label="Sankey energy flow diagram mapping solar generation, battery storage, and grid import into building load and export"
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
// 3. GRID IMPORT HEATMAP CHART (Hour of Day vs Date, Single-Hue Ivory-to-Grid)
// ============================================================================
interface GridImportHeatmapChartProps {
  data: HourlySimPoint[];
  height?: number | string;
  chartRef?: React.RefObject<ReactECharts>;
}

export const GridImportHeatmapChart: React.FC<GridImportHeatmapChartProps> = ({
  data,
  height = 420,
  chartRef,
}) => {
  const { dates, hours, heatmapData, maxImport } = useMemo(() => {
    // Extract distinct dates in chronological order
    const dateSet = new Set<string>();
    data.forEach((d) => {
      dateSet.add(d.timestamp.slice(0, 10));
    });
    const uniqueDates = Array.from(dateSet).sort();

    // 24 hours of the day
    const hourLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

    let maxVal = 0;
    const matrix: Array<[number, number, number, number, string]> = []; // [dateIdx, hourIdx, value, price, timestamp]

    data.forEach((d) => {
      const datePart = d.timestamp.slice(0, 10);
      const dateIdx = uniqueDates.indexOf(datePart);
      const hourPart = parseInt(d.timestamp.slice(11, 13), 10);

      if (dateIdx !== -1 && !isNaN(hourPart) && hourPart >= 0 && hourPart < 24) {
        const val = Number(d.grid_import_kw.toFixed(2));
        if (val > maxVal) maxVal = val;
        matrix.push([dateIdx, hourPart, val, d.price, d.timestamp]);
      }
    });

    return {
      dates: uniqueDates,
      hours: hourLabels,
      heatmapData: matrix,
      maxImport: maxVal,
    };
  }, [data]);

  const option = useMemo(() => {
    // Format dates for display
    const formattedDates = dates.map((d) => {
      const parts = d.split('-');
      if (parts.length === 3) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const m = parseInt(parts[1], 10) - 1;
        return `${months[m]} ${parseInt(parts[2], 10)}`;
      }
      return d;
    });

    const ceilingMax = Math.max(1, Math.ceil(maxImport));

    return {
      animation: false,
      animationDurationUpdate: 0,
      grid: {
        left: '5%',
        right: '4%',
        top: '8%',
        bottom: '16%',
        containLabel: true,
      },
      tooltip: {
        position: 'top',
        backgroundColor: '#FFFFFF',
        borderColor: DATA_COLORS.hairline,
        textStyle: { color: '#1B1F1D', fontSize: 11 },
        formatter: (params: unknown) => {
          const item = params as {
            data: [number, number, number, number, string];
          };
          if (!item || !item.data) return '';
          const [, hourIdx, val, price, timestamp] = item.data;
          const hr = String(hourIdx).padStart(2, '0') + ':00';
          return `
            <div style="font-family:sans-serif;padding:3px 2px;min-width:160px;">
              <div style="font-weight:600;color:#1B1F1D;margin-bottom:4px;">${timestamp || hr}</div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
                <span style="color:${DATA_COLORS.muted};">Grid Import:</span>
                <span style="font-weight:600;color:${DATA_COLORS.grid};">${val.toFixed(2)} kW</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;">
                <span style="color:${DATA_COLORS.muted};">Tariff Price:</span>
                <span style="font-weight:500;">₹ ${price.toFixed(2)} / kWh</span>
              </div>
            </div>
          `;
        },
      },
      xAxis: {
        type: 'category',
        data: formattedDates,
        splitArea: { show: true },
        axisLine: { lineStyle: { color: DATA_COLORS.hairline } },
        axisLabel: {
          color: DATA_COLORS.muted,
          fontSize: 10,
          interval: Math.max(0, Math.floor(formattedDates.length / 15)),
        },
      },
      yAxis: {
        type: 'category',
        data: hours,
        splitArea: { show: true },
        axisLine: { lineStyle: { color: DATA_COLORS.hairline } },
        axisLabel: {
          color: DATA_COLORS.muted,
          fontSize: 10,
          interval: 2, // Every 3 hours (00:00, 03:00, ...)
        },
      },
      // Single-hue ivory-to-grid-colour scale with legend in kW
      visualMap: {
        min: 0,
        max: ceilingMax,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '2%',
        itemWidth: 14,
        itemHeight: 180,
        text: [`${ceilingMax} kW`, '0 kW'],
        textStyle: { color: DATA_COLORS.muted, fontSize: 10 },
        inRange: {
          // Monochromatic ivory to steel-blue grid color progression
          color: ['#FAF8F5', '#DEE7EC', '#ADC5D2', '#7A9EB2', '#5F7A8C', '#395363'],
        },
      },
      series: [
        {
          name: 'Grid Import (kW)',
          type: 'heatmap',
          data: heatmapData,
          label: { show: false },
          itemStyle: {
            borderColor: '#FFFFFF',
            borderWidth: 0.5,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 8,
              shadowColor: 'rgba(95, 122, 140, 0.4)',
            },
          },
        },
      ],
    };
  }, [dates, hours, heatmapData, maxImport]);

  return (
    <div
      style={{ height, width: '100%' }}
      role="img"
      aria-label="Grid import intensity heatmap matrix across calendar dates and 24 hours of the day"
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
