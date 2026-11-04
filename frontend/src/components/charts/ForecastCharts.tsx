import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import '../../lib/echarts-theme';
import { DATA_COLORS } from '../../lib/echarts-theme';
import type { HourlySimPoint, HourlyOutlookPoint } from '../../api/types';

interface LinkedForecastResidualChartProps {
  data: HourlySimPoint[];
  height?: number | string;
  chartRef?: React.RefObject<ReactECharts>;
}

export const LinkedForecastResidualChart: React.FC<LinkedForecastResidualChartProps> = ({
  data,
  height = 540,
  chartRef,
}) => {
  const option = useMemo(() => {
    const times = data.map((d) => d.timestamp.slice(5, 16) || d.timestamp);
    const predicted = data.map((d) => d.solar_predicted_kw);
    const actual = data.map((d) => d.solar_actual_kw);
    const residuals = data.map((d) => Math.max(0, d.solar_predicted_kw - d.solar_actual_kw));

    // Find continuous fault intervals for markArea shading in fault color
    const markAreaPieces: Array<[{ xAxis: string; itemStyle?: { color: string } }, { xAxis: string }]> = [];
    let faultStart: string | null = null;

    data.forEach((pt, i) => {
      const timeStr = times[i];
      if (pt.fault_flag && !faultStart) {
        faultStart = timeStr;
      } else if (!pt.fault_flag && faultStart) {
        markAreaPieces.push([
          { xAxis: faultStart, itemStyle: { color: 'rgba(196, 81, 63, 0.14)' } },
          { xAxis: times[Math.max(0, i - 1)] },
        ]);
        faultStart = null;
      }
    });
    if (faultStart && times.length > 0) {
      markAreaPieces.push([
        { xAxis: faultStart, itemStyle: { color: 'rgba(196, 81, 63, 0.14)' } },
        { xAxis: times[times.length - 1] },
      ]);
    }

    return {
      animation: true,
      animationDuration: 700,
      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
        label: { backgroundColor: '#1B1F1D' },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', lineStyle: { color: DATA_COLORS.hairline, type: 'dashed' } },
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
          let text = `<div style="font-family:sans-serif;padding:3px 2px;">`;
          text += `<div style="font-weight:600;margin-bottom:4px;color:#1B1F1D;">${pt.timestamp}</div>`;
          text += `<div style="display:flex;justify-content:space-between;gap:12px;"><span>Predicted:</span><span style="font-weight:500;">${pt.solar_predicted_kw.toFixed(2)} kW</span></div>`;
          text += `<div style="display:flex;justify-content:space-between;gap:12px;"><span>Actual:</span><span style="font-weight:500;color:${DATA_COLORS.solar};">${pt.solar_actual_kw.toFixed(2)} kW</span></div>`;
          const res = Math.max(0, pt.solar_predicted_kw - pt.solar_actual_kw);
          text += `<div style="display:flex;justify-content:space-between;gap:12px;margin-top:2px;"><span>Residual:</span><span style="color:${res > 0.3 ? DATA_COLORS.fault : DATA_COLORS.muted};">${res.toFixed(2)} kW</span></div>`;
          if (pt.fault_flag) {
            text += `<div style="margin-top:4px;padding-top:4px;border-top:1px solid #E4DDD0;color:${DATA_COLORS.fault};font-weight:600;">⚠ Fault: ${pt.fault_severity || 'Deviation'}</div>`;
          }
          text += `</div>`;
          return text;
        },
      },
      legend: {
        top: 6,
        right: 12,
        data: ['Predicted Solar', 'Actual Solar', 'Generation Deficit'],
        textStyle: { fontSize: 11, color: DATA_COLORS.muted },
      },
      grid: [
        // Top chart (Solar Generation)
        {
          left: '4%',
          right: '4%',
          top: '12%',
          height: '52%',
          containLabel: true,
        },
        // Bottom chart (Residual Loss)
        {
          left: '4%',
          right: '4%',
          top: '72%',
          height: '22%',
          containLabel: true,
        },
      ],
      xAxis: [
        {
          type: 'category',
          gridIndex: 0,
          data: times,
          boundaryGap: false,
          axisLabel: { show: false },
          axisTick: { show: false },
          axisLine: { lineStyle: { color: DATA_COLORS.hairline } },
        },
        {
          type: 'category',
          gridIndex: 1,
          data: times,
          boundaryGap: false,
          axisLabel: { fontSize: 10, color: DATA_COLORS.muted },
          axisLine: { lineStyle: { color: DATA_COLORS.hairline } },
        },
      ],
      yAxis: [
        {
          type: 'value',
          gridIndex: 0,
          name: 'Power (kW)',
          nameTextStyle: { fontSize: 10, color: DATA_COLORS.muted },
          splitLine: { lineStyle: { color: DATA_COLORS.hairline } },
        },
        {
          type: 'value',
          gridIndex: 1,
          name: 'Deficit (kW)',
          nameTextStyle: { fontSize: 10, color: DATA_COLORS.muted },
          splitLine: { lineStyle: { color: DATA_COLORS.hairline } },
        },
      ],
      series: [
        // Actual Solar (solid)
        {
          name: 'Actual Solar',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: actual,
          sampling: 'lttb',
          smooth: true,
          showSymbol: false,
          itemStyle: { color: DATA_COLORS.solar },
          lineStyle: { width: 2, color: DATA_COLORS.solar },
          areaStyle: { color: 'rgba(217, 148, 30, 0.12)' },
          markArea: {
            data: markAreaPieces,
          },
        },
        // Predicted Solar (dashed)
        {
          name: 'Predicted Solar',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: predicted,
          sampling: 'lttb',
          smooth: true,
          showSymbol: false,
          itemStyle: { color: DATA_COLORS.solar },
          lineStyle: { width: 1.75, type: 'dashed', color: DATA_COLORS.forecast },
        },
        // Residual Deficit (bar)
        {
          name: 'Generation Deficit',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: residuals,
          itemStyle: { color: 'rgba(196, 81, 63, 0.75)' },
          barMaxWidth: 10,
        },
      ],
    };
  }, [data]);

  return (
    <div
      style={{ height, width: '100%' }}
      role="img"
      aria-label="Interactive solar generation actual vs predicted time series with fault event overlays"
    >
      <ReactECharts
        ref={chartRef}
        option={option}
        theme="helios"
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'svg' }}
        notMerge={true}
      />
    </div>
  );
};

interface ZoomedFaultChartProps {
  eventStart: string;
  eventEnd: string;
  data: HourlySimPoint[];
  height?: number | string;
}

export const ZoomedFaultChart: React.FC<ZoomedFaultChartProps> = ({
  eventStart,
  eventEnd,
  data,
  height = 260,
}) => {
  const option = useMemo(() => {
    // Filter window around the event
    const startIndex = data.findIndex((d) => d.timestamp >= eventStart);
    const endIndex = data.findIndex((d) => d.timestamp >= eventEnd);

    const safeStart = Math.max(0, (startIndex >= 0 ? startIndex : 0) - 3);
    const safeEnd = Math.min(data.length - 1, (endIndex >= 0 ? endIndex : data.length - 1) + 3);
    const slice = data.slice(safeStart, safeEnd + 1);

    const times = slice.map((d) => d.timestamp.slice(11, 16) || d.timestamp);
    const actual = slice.map((d) => d.solar_actual_kw);
    const predicted = slice.map((d) => d.solar_predicted_kw);

    return {
      animation: true,
      tooltip: { trigger: 'axis' },
      legend: {
        top: 2,
        right: 8,
        data: ['Expected Solar', 'Observed Solar'],
        textStyle: { fontSize: 10, color: DATA_COLORS.muted },
      },
      grid: {
        left: '5%',
        right: '5%',
        top: '20%',
        bottom: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: times,
        axisLabel: { fontSize: 10, color: DATA_COLORS.muted },
        axisLine: { lineStyle: { color: DATA_COLORS.hairline } },
      },
      yAxis: {
        type: 'value',
        name: 'kW',
        nameTextStyle: { fontSize: 10, color: DATA_COLORS.muted },
        splitLine: { lineStyle: { color: DATA_COLORS.hairline } },
      },
      series: [
        {
          name: 'Expected Solar',
          type: 'line',
          data: predicted,
          smooth: true,
          showSymbol: false,
          itemStyle: { color: DATA_COLORS.solar },
          lineStyle: { width: 1.75, type: 'dashed', color: DATA_COLORS.forecast },
        },
        {
          name: 'Observed Solar',
          type: 'line',
          data: actual,
          smooth: true,
          showSymbol: true,
          symbolSize: 5,
          itemStyle: { color: DATA_COLORS.fault },
          lineStyle: { width: 2, color: DATA_COLORS.fault },
          areaStyle: { color: 'rgba(196, 81, 63, 0.15)' },
        },
      ],
    };
  }, [data, eventStart, eventEnd]);

  return (
    <div
      style={{ height, width: '100%' }}
      role="img"
      aria-label="Diagnostic generation loss detail for selected fault event"
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

interface OutlookDispatchChartProps {
  data: HourlyOutlookPoint[];
  height?: number | string;
  chartRef?: React.RefObject<ReactECharts>;
}

export const OutlookDispatchChart: React.FC<OutlookDispatchChartProps> = ({
  data,
  height = 500,
  chartRef,
}) => {
  const option = useMemo(() => {
    const times = data.map((d) => d.timestamp.slice(11, 16) || `${d.hour}:00`);
    const solar = data.map((d) => d.solar_predicted_kw);
    const load = data.map((d) => d.building_load_kw);
    // Charge as positive green bar, discharge as negative coral/red bar
    const charge = data.map((d) => d.battery_charge_kw);
    const discharge = data.map((d) => -d.battery_discharge_kw);
    const soc = data.map((d) => d.soc_pct);

    return {
      animation: true,
      animationDuration: 700,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', lineStyle: { color: DATA_COLORS.hairline, type: 'dashed' } },
        backgroundColor: '#FFFFFF',
        borderColor: DATA_COLORS.hairline,
        textStyle: { color: '#1B1F1D', fontSize: 11 },
        formatter: (params: unknown) => {
          const list = params as Array<{ dataIndex: number }>;
          if (!list || list.length === 0) return '';
          const idx = list[0].dataIndex;
          const pt = data[idx];
          if (!pt) return '';
          let text = `<div style="font-family:sans-serif;padding:3px 2px;">`;
          text += `<div style="font-weight:600;margin-bottom:4px;">${pt.timestamp} (Hour ${pt.hour})</div>`;
          text += `<div style="display:flex;justify-content:space-between;gap:12px;"><span>Solar:</span><span style="font-weight:500;color:${DATA_COLORS.solar};">${pt.solar_predicted_kw.toFixed(2)} kW</span></div>`;
          text += `<div style="display:flex;justify-content:space-between;gap:12px;"><span>Load:</span><span style="font-weight:500;color:${DATA_COLORS.load};">${pt.building_load_kw.toFixed(2)} kW</span></div>`;
          if (pt.battery_charge_kw > 0.05) {
            text += `<div style="display:flex;justify-content:space-between;gap:12px;color:${DATA_COLORS.battery};"><span>Charge:</span><span>+${pt.battery_charge_kw.toFixed(2)} kW</span></div>`;
          }
          if (pt.battery_discharge_kw > 0.05) {
            text += `<div style="display:flex;justify-content:space-between;gap:12px;color:${DATA_COLORS.fault};"><span>Discharge:</span><span>-${pt.battery_discharge_kw.toFixed(2)} kW</span></div>`;
          }
          text += `<div style="display:flex;justify-content:space-between;gap:12px;margin-top:2px;"><span>SoC:</span><span style="font-weight:600;">${pt.soc_pct.toFixed(1)}%</span></div>`;
          text += `<div style="display:flex;justify-content:space-between;gap:12px;color:${DATA_COLORS.muted};"><span>Tariff:</span><span>₹${pt.grid_price.toFixed(2)}/kWh</span></div>`;
          text += `</div>`;
          return text;
        },
      },
      legend: {
        top: 6,
        right: 12,
        data: ['Predicted Solar', 'Building Load', 'Battery Charge', 'Battery Discharge', 'State of Charge (%)'],
        textStyle: { fontSize: 11, color: DATA_COLORS.muted },
      },
      grid: {
        left: '4%',
        right: '4%',
        top: '15%',
        bottom: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: times,
        boundaryGap: true,
        axisLabel: { fontSize: 10, color: DATA_COLORS.muted },
        axisLine: { lineStyle: { color: DATA_COLORS.hairline } },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Power (kW)',
          nameTextStyle: { fontSize: 10, color: DATA_COLORS.muted },
          splitLine: { lineStyle: { color: DATA_COLORS.hairline } },
        },
        {
          type: 'value',
          name: 'SoC (%)',
          min: 0,
          max: 100,
          nameTextStyle: { fontSize: 10, color: DATA_COLORS.muted },
          splitLine: { show: false },
          axisLabel: { formatter: '{value}%' },
        },
      ],
      series: [
        // Predicted Solar (smooth area)
        {
          name: 'Predicted Solar',
          type: 'line',
          yAxisIndex: 0,
          data: solar,
          smooth: true,
          showSymbol: false,
          itemStyle: { color: DATA_COLORS.solar },
          lineStyle: { width: 2, color: DATA_COLORS.solar },
          areaStyle: { color: 'rgba(217, 148, 30, 0.12)' },
        },
        // Building Load (line)
        {
          name: 'Building Load',
          type: 'line',
          yAxisIndex: 0,
          data: load,
          smooth: true,
          showSymbol: false,
          itemStyle: { color: DATA_COLORS.load },
          lineStyle: { width: 1.5, type: 'dashed', color: DATA_COLORS.load },
        },
        // Charge Bar
        {
          name: 'Battery Charge',
          type: 'bar',
          yAxisIndex: 0,
          data: charge,
          stack: 'battery',
          itemStyle: { color: DATA_COLORS.battery },
          barMaxWidth: 14,
        },
        // Discharge Bar
        {
          name: 'Battery Discharge',
          type: 'bar',
          yAxisIndex: 0,
          data: discharge,
          stack: 'battery',
          itemStyle: { color: 'rgba(196, 81, 63, 0.8)' },
          barMaxWidth: 14,
        },
        // State of Charge Line
        {
          name: 'State of Charge (%)',
          type: 'line',
          yAxisIndex: 1,
          data: soc,
          smooth: true,
          showSymbol: false,
          itemStyle: { color: '#1B1F1D' },
          lineStyle: { width: 2, color: '#1B1F1D' },
        },
      ],
    };
  }, [data]);

  return (
    <div
      style={{ height, width: '100%' }}
      role="img"
      aria-label="Interactive solar generation actual vs predicted time series with fault event overlays"
    >
      <ReactECharts
        ref={chartRef}
        option={option}
        theme="helios"
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'svg' }}
        notMerge={true}
      />
    </div>
  );
};

