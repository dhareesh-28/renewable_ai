import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import '../../lib/echarts-theme';
import { DATA_COLORS } from '../../lib/echarts-theme';
import type { ScatterPoint, FeatureImportanceItem } from '../../api/types';

// ============================================================================
// 1. PREDICTED VS ACTUAL SCATTER PLOT (with y = x Parity Line)
// ============================================================================
interface PredictedActualScatterChartProps {
  data: ScatterPoint[];
  height?: number | string;
  chartRef?: React.RefObject<ReactECharts>;
}

export const PredictedActualScatterChart: React.FC<PredictedActualScatterChartProps> = ({
  data,
  height = 420,
  chartRef,
}) => {
  const option = useMemo(() => {
    let maxVal = 7.0;
    data.forEach((d) => {
      if (d.actual > maxVal) maxVal = d.actual;
      if (d.predicted > maxVal) maxVal = d.predicted;
    });
    const axisMax = Math.ceil(maxVal * 1.05);

    const scatterPoints = data.map((d) => [
      Number(d.actual.toFixed(3)),
      Number(d.predicted.toFixed(3)),
    ]);

    return {
      animation: false,
      animationDurationUpdate: 0,
      grid: {
        left: '5%',
        right: '4%',
        top: '12%',
        bottom: '10%',
        containLabel: true,
      },
      legend: {
        top: 6,
        right: 12,
        data: ['Observed Test Hours', 'Ideal Parity (y = x)'],
        textStyle: { fontSize: 11, color: DATA_COLORS.muted },
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#FFFFFF',
        borderColor: DATA_COLORS.hairline,
        textStyle: { color: '#1B1F1D', fontSize: 11 },
        formatter: (params: unknown) => {
          const item = params as {
            seriesName: string;
            value: [number, number];
          };
          if (!item.value) return '';
          const [act, pred] = item.value;
          const residual = pred - act;
          return `
            <div style="font-family:sans-serif;padding:3px 2px;min-width:170px;">
              <div style="font-weight:600;margin-bottom:4px;color:#1B1F1D;">Test Sample Point</div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
                <span style="color:${DATA_COLORS.muted};">Actual Solar:</span>
                <span style="font-weight:600;color:${DATA_COLORS.solar};">${act.toFixed(3)} kW</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
                <span style="color:${DATA_COLORS.muted};">Predicted Solar:</span>
                <span style="font-weight:600;color:${DATA_COLORS.battery};">${pred.toFixed(3)} kW</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-top:4px;padding-top:4px;border-top:1px solid #E4DDD0;">
                <span style="color:${DATA_COLORS.muted};">Residual (Error):</span>
                <span style="font-weight:500;">${residual >= 0 ? '+' : ''}${residual.toFixed(3)} kW</span>
              </div>
            </div>
          `;
        },
      },
      xAxis: {
        type: 'value',
        name: 'Actual Solar (kW)',
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { color: DATA_COLORS.muted, fontSize: 11 },
        min: 0,
        max: axisMax,
        axisLine: { lineStyle: { color: DATA_COLORS.hairline } },
        axisLabel: { color: DATA_COLORS.muted, fontSize: 10 },
        splitLine: { lineStyle: { color: DATA_COLORS.hairline, type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        name: 'Predicted Solar (kW)',
        nameTextStyle: { color: DATA_COLORS.muted, fontSize: 11 },
        min: 0,
        max: axisMax,
        axisLine: { lineStyle: { color: DATA_COLORS.hairline } },
        axisLabel: { color: DATA_COLORS.muted, fontSize: 10 },
        splitLine: { lineStyle: { color: DATA_COLORS.hairline, type: 'dashed' } },
      },
      series: [
        // 1. Ideal parity reference line (y = x)
        {
          name: 'Ideal Parity (y = x)',
          type: 'line',
          data: [
            [0, 0],
            [axisMax, axisMax],
          ],
          lineStyle: {
            color: '#8A8578',
            width: 1.8,
            type: 'dashed',
          },
          showSymbol: false,
          silent: true,
          z: 2,
        },
        // 2. Scatter observations
        {
          name: 'Observed Test Hours',
          type: 'scatter',
          data: scatterPoints,
          symbolSize: 6,
          itemStyle: {
            color: 'rgba(63, 143, 107, 0.65)',
            borderColor: '#3F8F6B',
            borderWidth: 0.5,
          },
          emphasis: {
            itemStyle: {
              color: DATA_COLORS.solar,
              borderColor: '#D9941E',
              borderWidth: 1.5,
              shadowBlur: 8,
              shadowColor: 'rgba(217, 148, 30, 0.5)',
            },
          },
          z: 3,
        },
      ],
    };
  }, [data]);

  return (
    <div
      style={{ height, width: '100%' }}
      role="img"
      aria-label="Predicted versus actual solar generation scatter plot comparing held-out test observations against ideal y equals x diagonal parity"
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
// 2. FEATURE IMPORTANCE HORIZONTAL BAR CHART
// ============================================================================
interface FeatureImportanceChartProps {
  data: FeatureImportanceItem[];
  height?: number | string;
  chartRef?: React.RefObject<ReactECharts>;
}

const FEATURE_LABEL_MAP: Record<string, string> = {
  irradiance_wm2: 'Global Solar Irradiance (W/m²)',
  temperature_c: 'Ambient Temperature (°C)',
  day_cos: 'Day of Year (Cos harmonic)',
  day_of_year: 'Day of Year (Ordinal day)',
  cloud_cover: 'Atmospheric Cloud Fraction (0–1)',
  day_sin: 'Day of Year (Sin harmonic)',
  hour: 'Hour of Day (0–23)',
  hour_sin: 'Diurnal Cycle (Sin harmonic)',
  month: 'Month of Year (1–12)',
  hour_cos: 'Diurnal Cycle (Cos harmonic)',
};

export const FeatureImportanceChart: React.FC<FeatureImportanceChartProps> = ({
  data,
  height = 400,
  chartRef,
}) => {
  const option = useMemo(() => {
    // Sort ascending so highest importance appears at top in horizontal layout
    const sorted = [...data].sort((a, b) => a.importance - b.importance);

    const labels = sorted.map((d) => FEATURE_LABEL_MAP[d.feature] || d.feature);
    const displayValues = sorted.map((d) => Number((d.importance * 100).toFixed(4)));

    return {
      animation: false,
      animationDurationUpdate: 0,
      grid: {
        left: '26%',
        right: '12%',
        top: '6%',
        bottom: '8%',
        containLabel: false,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#FFFFFF',
        borderColor: DATA_COLORS.hairline,
        textStyle: { color: '#1B1F1D', fontSize: 11 },
        formatter: (params: unknown) => {
          const list = params as Array<{
            dataIndex: number;
          }>;
          if (!list || list.length === 0) return '';
          const idx = list[0].dataIndex;
          const feat = sorted[idx];
          if (!feat) return '';

          return `
            <div style="font-family:sans-serif;padding:3px 2px;min-width:190px;">
              <div style="font-weight:600;margin-bottom:4px;color:#1B1F1D;">${FEATURE_LABEL_MAP[feat.feature] || feat.feature}</div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
                <span style="color:${DATA_COLORS.muted};">Technical Variable:</span>
                <span style="font-mono;font-weight:500;">${feat.feature}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-top:3px;padding-top:3px;border-top:1px solid #E4DDD0;">
                <span style="color:${DATA_COLORS.muted};">Gini Importance:</span>
                <span style="font-weight:600;color:${DATA_COLORS.battery};">${(feat.importance * 100).toFixed(4)}%</span>
              </div>
            </div>
          `;
        },
      },
      xAxis: {
        type: 'value',
        name: 'Importance (%)',
        nameTextStyle: { color: DATA_COLORS.muted, fontSize: 11 },
        axisLine: { lineStyle: { color: DATA_COLORS.hairline } },
        axisLabel: {
          formatter: '{value}%',
          color: DATA_COLORS.muted,
          fontSize: 10,
        },
        splitLine: { lineStyle: { color: DATA_COLORS.hairline, type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: DATA_COLORS.hairline } },
        axisLabel: {
          color: DATA_COLORS.ink,
          fontSize: 11,
          fontFamily: '"Inter Variable", sans-serif',
        },
        axisTick: { show: false },
      },
      series: [
        {
          name: 'Relative Gini Importance',
          type: 'bar',
          data: displayValues,
          itemStyle: {
            color: DATA_COLORS.battery,
            borderRadius: [0, 3, 3, 0],
          },
          label: {
            show: true,
            position: 'right',
            formatter: (p: { value: number }) => `${p.value.toFixed(2)}%`,
            color: DATA_COLORS.muted,
            fontSize: 10,
            fontFamily: '"Inter Variable", sans-serif',
          },
          barMaxWidth: 18,
        },
      ],
    };
  }, [data]);

  return (
    <div
      style={{ height, width: '100%' }}
      role="img"
      aria-label="Sorted horizontal bar chart displaying relative predictive feature importance for Random Forest solar generation regression"
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
// 3. CONFUSION MATRIX HEATMAP (Ivory-to-Moss Scale)
// ============================================================================
interface ConfusionMatrixCardProps {
  title: string;
  subtitle: string;
  matrix: number[][]; // [[tn, fp], [fn, tp]]
  f1: number;
  precision: number;
  recall: number;
}

export const ConfusionMatrixCard: React.FC<ConfusionMatrixCardProps> = ({
  title,
  subtitle,
  matrix,
  f1,
  precision,
  recall,
}) => {
  const tn = matrix[0]?.[0] ?? 0;
  const fp = matrix[0]?.[1] ?? 0;
  const fn = matrix[1]?.[0] ?? 0;
  const tp = matrix[1]?.[1] ?? 0;

  const total = tn + fp + fn + tp || 1;

  // Function to compute ivory-to-moss background color based on cell count
  const getCellColor = (count: number) => {
    if (count === 0) return { bg: 'bg-[#FAF8F5]', text: 'text-ink/60', border: 'border-hairline' };
    const pct = count / total;
    if (pct > 0.8) {
      // Very high count (e.g. TN ~2100) -> deep moss with crisp ivory text
      return { bg: 'bg-[#1F2B26]', text: 'text-[#FAF7F2]', border: 'border-moss' };
    }
    if (pct > 0.02) {
      // Moderate count (e.g. TP ~62, FP ~44) -> mid moss
      return { bg: 'bg-[#4A7760]/30', text: 'text-ink font-semibold', border: 'border-[#3F8F6B]/30' };
    }
    // Low count (e.g. TP ~21) -> soft moss tint
    return { bg: 'bg-[#6D9F84]/15', text: 'text-ink', border: 'border-[#3F8F6B]/20' };
  };

  const styleTN = getCellColor(tn);
  const styleFP = getCellColor(fp);
  const styleFN = getCellColor(fn);
  const styleTP = getCellColor(tp);

  return (
    <div
      className="border border-hairline rounded-frame p-5 bg-surface/60 flex flex-col justify-between"
      role="region"
      aria-label={`Confusion matrix for ${title}: True Negative ${tn}, False Positive ${fp}, False Negative ${fn}, True Positive ${tp}`}
    >
      <div>
        <div className="text-[11px] uppercase tracking-label text-muted mb-1">{title}</div>
        <div className="text-sm font-medium text-ink mb-4">{subtitle}</div>

        {/* 2x2 Grid Confusion Matrix */}
        <div className="space-y-1.5">
          {/* Header row: Predicted labels */}
          <div className="grid grid-cols-2 gap-1.5 text-center text-[10px] uppercase tracking-label text-muted">
            <div>Pred: Healthy</div>
            <div>Pred: Fault</div>
          </div>

          {/* Row 1: Actual Healthy */}
          <div className="grid grid-cols-2 gap-1.5">
            {/* True Negative */}
            <div className={`p-3 rounded-control border ${styleTN.border} ${styleTN.bg} flex flex-col justify-between transition-colors`}>
              <div className="flex items-center justify-between text-[10px] text-muted uppercase tracking-label">
                <span>TN</span>
                <span>{((tn / total) * 100).toFixed(1)}%</span>
              </div>
              <div className={`font-serif text-2xl font-light mt-1 tabular-nums ${styleTN.text}`}>
                {tn.toLocaleString()}
              </div>
            </div>

            {/* False Positive */}
            <div className={`p-3 rounded-control border ${styleFP.border} ${styleFP.bg} flex flex-col justify-between transition-colors`}>
              <div className="flex items-center justify-between text-[10px] text-muted uppercase tracking-label">
                <span>FP</span>
                <span>{((fp / total) * 100).toFixed(1)}%</span>
              </div>
              <div className={`font-serif text-2xl font-light mt-1 tabular-nums ${styleFP.text}`}>
                {fp.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Row 2: Actual Fault */}
          <div className="grid grid-cols-2 gap-1.5">
            {/* False Negative */}
            <div className={`p-3 rounded-control border ${styleFN.border} ${styleFN.bg} flex flex-col justify-between transition-colors`}>
              <div className="flex items-center justify-between text-[10px] text-muted uppercase tracking-label">
                <span>FN</span>
                <span>{((fn / total) * 100).toFixed(1)}%</span>
              </div>
              <div className={`font-serif text-2xl font-light mt-1 tabular-nums ${styleFN.text}`}>
                {fn.toLocaleString()}
              </div>
            </div>

            {/* True Positive */}
            <div className={`p-3 rounded-control border ${styleTP.border} ${styleTP.bg} flex flex-col justify-between transition-colors`}>
              <div className="flex items-center justify-between text-[10px] text-muted uppercase tracking-label">
                <span>TP</span>
                <span>{((tp / total) * 100).toFixed(1)}%</span>
              </div>
              <div className={`font-serif text-2xl font-light mt-1 tabular-nums ${styleTP.text}`}>
                {tp.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Footer */}
      <div className="mt-4 pt-3 border-t border-hairline grid grid-cols-3 gap-2 text-center text-caption">
        <div>
          <div className="text-[10px] uppercase tracking-label text-muted">Precision</div>
          <div className="font-sans text-sm tabular-nums font-medium text-ink mt-0.5">
            {(precision * 100).toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-label text-muted">Recall</div>
          <div className="font-sans text-sm tabular-nums font-medium text-ink mt-0.5">
            {(recall * 100).toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-label text-muted">F1-Score</div>
          <div className="font-sans text-sm tabular-nums font-bold text-battery mt-0.5">
            {f1.toFixed(3)}
          </div>
        </div>
      </div>
    </div>
  );
};
