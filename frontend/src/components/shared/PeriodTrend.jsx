import { useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { TooltipComponent, GridComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { ChartContainer } from './ChartContainer';

echarts.use([LineChart, BarChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer]);

const PERIOD_COLORS = ['#4f46e5', '#0891b2', '#d97706', '#059669', '#e11d48', '#7c3aed', '#ca8a04', '#0e7490'];

function fmtInr(v) {
  if (v == null || Number.isNaN(v)) return '--';
  return `₹${Math.round(Number(v)).toLocaleString('en-IN')}`;
}

function fmtCompact(v) {
  if (v >= 10000000) return `${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
  return String(v);
}

/**
 * Trend + comparison charts across selected closing-inventory periods.
 * `periods`: array of periodSummaries entries ({ period, totalValue, totalStock, momValueChange, byType })
 * `selectedTypes`: optional array of product types — when non-empty, both charts
 * show values for ONLY those types (trend line = sum of the selected types).
 */
export function PeriodTrend({ periods, startIndex = 0, selectedTypes = [] }) {
  const periodValue = (p) => {
    if (selectedTypes.length === 0) return p.totalValue;
    return (p.byType ?? [])
      .filter((t) => selectedTypes.includes(t.type))
      .reduce((s, t) => s + t.totalValue, 0);
  };

  const trendOption = useMemo(() => {
    if (!periods || periods.length === 0) return null;

    // 2+ product types selected → one trend line per type for comparison
    if (selectedTypes.length >= 2) {
      return {
        tooltip: {
          trigger: 'axis',
          formatter: (params) => {
            let s = `<b>${params[0].name}</b><br/>`;
            params.forEach((pr) => {
              if (pr.value != null) s += `${pr.marker} ${pr.seriesName}: ${fmtInr(pr.value)}<br/>`;
            });
            return s;
          },
        },
        legend: { bottom: 0, textStyle: { fontSize: 11 } },
        grid: { left: '3%', right: '4%', bottom: '14%', top: 30, containLabel: true },
        xAxis: {
          type: 'category',
          data: periods.map((p) => p.period),
          axisLabel: { fontSize: 11, color: '#64748b' },
        },
        yAxis: {
          type: 'value',
          axisLabel: { fontSize: 11, color: '#64748b', formatter: fmtCompact },
          splitLine: { lineStyle: { color: '#f1f5f9' } },
        },
        series: selectedTypes.map((t, i) => ({
          name: t,
          type: 'line',
          connectNulls: true,
          data: periods.map((p) => {
            const entry = (p.byType ?? []).find((x) => x.type === t);
            return entry ? Math.round(entry.totalValue) : null;
          }),
          symbolSize: 7,
          lineStyle: { width: 2.5, color: PERIOD_COLORS[i % PERIOD_COLORS.length] },
          itemStyle: { color: PERIOD_COLORS[i % PERIOD_COLORS.length], borderColor: '#fff', borderWidth: 2 },
        })),
      };
    }

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const p = periods[params[0].dataIndex];
          const typeNote = selectedTypes.length > 0 ? `<br/><span style="color:#64748b">Types: ${selectedTypes.join(', ')}</span>` : '';
          return `<b>${p.period}</b><br/>Value: ${fmtInr(periodValue(p))}${typeNote}`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '8%', top: 30, containLabel: true },
      xAxis: {
        type: 'category',
        data: periods.map((p) => p.period),
        axisLabel: { fontSize: 11, color: '#64748b' },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 11, color: '#64748b', formatter: fmtCompact },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      series: [
        {
          name: 'Inventory Value',
          type: 'line',
          data: periods.map((p) => Math.round(periodValue(p))),
          symbolSize: 9,
          lineStyle: { width: 3, color: '#4f46e5' },
          itemStyle: { color: '#4f46e5', borderColor: '#fff', borderWidth: 2 },
          areaStyle: { color: 'rgba(79,70,229,0.08)' },
          label: {
            show: true,
            position: 'top',
            fontSize: 10,
            color: '#334155',
            formatter: (p) => fmtCompact(p.value),
          },
        },
      ],
    };
  }, [periods, selectedTypes]);

  const compareOption = useMemo(() => {
    if (!periods || periods.length === 0) return null;
    let types = [...new Set(periods.flatMap((p) => (p.byType ?? []).map((t) => t.type)))];
    if (selectedTypes.length > 0) types = types.filter((t) => selectedTypes.includes(t));
    if (types.length === 0) return null;
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          let s = `<b>${params[0].name}</b><br/>`;
          params.forEach((pr) => { s += `${pr.marker} ${pr.seriesName}: ${fmtInr(pr.value)}<br/>`; });
          return s;
        },
      },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: '3%', right: '4%', bottom: '14%', top: 30, containLabel: true },
      xAxis: { type: 'category', data: types, axisLabel: { fontSize: 11, color: '#64748b' } },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 11, color: '#64748b', formatter: fmtCompact },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      series: periods.map((p, i) => ({
        name: p.period,
        type: 'bar',
        barMaxWidth: 34,
        data: types.map((t) => {
          const entry = (p.byType ?? []).find((x) => x.type === t);
          return entry ? Math.round(entry.totalValue) : 0;
        }),
        itemStyle: { color: PERIOD_COLORS[i % PERIOD_COLORS.length], borderRadius: [4, 4, 0, 0] },
      })),
    };
  }, [periods, selectedTypes]);

  if (!periods || periods.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartContainer
        title="Inventory Value Trend"
        subtitle="Total value across selected periods"
        index={startIndex}
      >
        {trendOption && (
          <ReactEChartsCore echarts={echarts} option={trendOption} style={{ height: 320 }} opts={{ renderer: 'canvas' }} notMerge />
        )}
      </ChartContainer>
      <ChartContainer
        title="Period Comparison by Product Type"
        subtitle="Side-by-side value per type for each selected period"
        index={startIndex + 1}
      >
        {compareOption ? (
          <ReactEChartsCore echarts={echarts} option={compareOption} style={{ height: 320 }} opts={{ renderer: 'canvas' }} notMerge />
        ) : (
          <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
            No type breakdown available
          </div>
        )}
      </ChartContainer>
    </div>
  );
}
