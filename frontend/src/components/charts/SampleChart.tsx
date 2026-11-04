import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import '../../lib/echarts-theme';
import { DATA_COLORS } from '../../lib/echarts-theme';

export const SampleChart: React.FC<{ className?: string }> = ({ className = '' }) => {
  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`),
    []
  );

  // Synthetic 24-hour summer profile
  const solarPredicted = [
    0.0, 0.0, 0.0, 0.0, 0.0, 0.2, 1.4, 3.2, 5.5, 7.2, 8.4, 8.8,
    8.6, 7.9, 6.3, 4.4, 2.3, 0.8, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0,
  ];

  const solarActual = [
    0.0, 0.0, 0.0, 0.0, 0.0, 0.18, 1.35, 3.1, 5.2, 7.1, 8.2, 8.7,
    8.4, 7.6, 6.1, 4.2, 2.1, 0.75, 0.08, 0.0, 0.0, 0.0, 0.0, 0.0,
  ];

  const buildingLoad = [
    1.6, 1.5, 1.4, 1.4, 1.5, 1.8, 2.7, 3.4, 2.8, 2.4, 2.6, 2.9,
    3.1, 2.8, 2.5, 2.6, 3.2, 4.6, 5.2, 4.9, 4.1, 3.2, 2.4, 1.8,
  ];

  const batterySocPct = [
    50, 46, 42, 38, 34, 32, 30, 45, 68, 88, 98, 100,
    100, 100, 100, 95, 88, 72, 55, 40, 28, 20, 18, 15,
  ];

  const option = useMemo(
    () => ({
      animation: true,
      animationDuration: 1200,
      animationEasing: 'cubicOut',
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
      },
      legend: {
        top: 0,
        right: '2%',
        data: ['Actual Solar', 'Predicted Solar', 'Building Load', 'Battery SoC'],
      },
      grid: {
        left: '2%',
        right: '4%',
        top: '16%',
        bottom: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: hours,
        name: 'Hour',
        nameLocation: 'end',
        nameTextStyle: {
          color: DATA_COLORS.muted,
          fontSize: 11,
          padding: [0, 0, 0, 8],
        },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Power (kW)',
          nameTextStyle: {
            color: DATA_COLORS.muted,
            fontSize: 11,
            align: 'right',
            padding: [0, 0, 8, 0],
          },
          splitLine: {
            show: true,
            lineStyle: {
              color: DATA_COLORS.hairline,
              width: 1,
            },
          },
        },
        {
          type: 'value',
          name: 'SoC (%)',
          min: 0,
          max: 100,
          nameTextStyle: {
            color: DATA_COLORS.muted,
            fontSize: 11,
            align: 'left',
            padding: [0, 0, 8, 0],
          },
          splitLine: {
            show: false,
          },
        },
      ],
      series: [
        {
          name: 'Actual Solar',
          type: 'line',
          data: solarActual,
          itemStyle: { color: DATA_COLORS.solar },
          lineStyle: { width: 2, color: DATA_COLORS.solar },
          areaStyle: {
            color: 'rgba(217, 148, 30, 0.12)', // flat translucent fill
          },
          smooth: true,
        },
        {
          name: 'Predicted Solar',
          type: 'line',
          data: solarPredicted,
          itemStyle: { color: DATA_COLORS.solar },
          lineStyle: {
            width: 2,
            type: 'dashed',
            color: DATA_COLORS.forecast,
          },
          smooth: true,
        },
        {
          name: 'Building Load',
          type: 'line',
          data: buildingLoad,
          itemStyle: { color: DATA_COLORS.load },
          lineStyle: { width: 2, color: DATA_COLORS.load },
          areaStyle: {
            color: 'rgba(138, 133, 120, 0.10)',
          },
          smooth: true,
        },
        {
          name: 'Battery SoC',
          type: 'line',
          yAxisIndex: 1,
          data: batterySocPct,
          itemStyle: { color: DATA_COLORS.battery },
          lineStyle: { width: 2, color: DATA_COLORS.battery },
          smooth: true,
        },
      ],
    }),
    [hours]
  );

  return (
    <div className={`w-full h-80 ${className}`}>
      <ReactECharts
        option={option}
        theme="helios"
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  );
};

