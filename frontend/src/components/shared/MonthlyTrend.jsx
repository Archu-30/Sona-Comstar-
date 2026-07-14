import { useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { TooltipComponent, GridComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { ChartContainer } from './ChartContainer';

echarts.use([LineChart, BarChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer]);

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

export function monthLabel(ym) {
  const [y, m] = ym.split('-');
  const idx = Number(m) - 1;
  return `${MONTH_NAMES[idx] ?? m} ${y}`;
}

const LINE_COLORS = ['#4f46e5', '#0891b2', '#d97706', '#059669', '#e11d48', '#7c3aed', '#ca8a04', '#0e7490'];

/**
 * Monthly value trend line chart for data shaped [{ month: 'YYYY-MM', totalValue, totalQuantity, count }].
 * `selectedYears` / `selectedMonths` — arrays; empty = all. Months use 3-letter names ('Apr').
 * `compareByYear` — when true, plots ONE LINE PER YEAR (x-axis = Jan..Dec) so
 * multiple selected years/months can be compared against each other.
 */
export function MonthlyTrend({
  data,
  selectedYears = [],
  selectedMonths = [],
  title,
  subtitle,
  index = 0,
  height = 320,
  compareByYear = false,
  seriesData = null,
}) {
  const filtered = useMemo(() => {
    return (data ?? []).filter((d) => {
      const [y, m] = d.month.split('-');
      const monthName = MONTH_NAMES[Number(m) - 1];
      if (selectedYears.length > 0 && !selectedYears.includes(y)) return false;
      if (selectedMonths.length > 0 && !selectedMonths.includes(monthName)) return false;
      return true;
    });
  }, [data, selectedYears, selectedMonths]);

  // Multi-series mode: seriesData = [{ month:'YYYY-MM', series:'name', value }]
  // One trend line per distinct `series`, filtered by the year/month selections.
  const multiOption = useMemo(() => {
    if (!seriesData || seriesData.length === 0) return null;
    const rows = seriesData.filter((d) => {
      const [y, m] = d.month.split('-');
      const monthName = MONTH_NAMES[Number(m) - 1];
      if (selectedYears.length > 0 && !selectedYears.includes(y)) return false;
      if (selectedMonths.length > 0 && !selectedMonths.includes(monthName)) return false;
      return true;
    });
    if (rows.length === 0) return null;
    const months = [...new Set(rows.map((r) => r.month))].sort();
    const names = [...new Set(rows.map((r) => r.series))];
    const valMap = new Map(rows.map((r) => [`${r.series}|${r.month}`, r.value]));
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
      grid: { left: '3%', right: '4%', bottom: '16%', top: 30, containLabel: true },
      xAxis: {
        type: 'category',
        data: months.map(monthLabel),
        axisLabel: { fontSize: 9, color: '#64748b', interval: 0, rotate: 35 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 11, color: '#64748b', formatter: fmtCompact },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      series: names.map((n, i) => ({
        name: n,
        type: 'line',
        connectNulls: true,
        data: months.map((mo) => {
          const v = valMap.get(`${n}|${mo}`);
          return v != null ? Math.round(v) : null;
        }),
        symbolSize: 7,
        lineStyle: { width: 2.5, color: LINE_COLORS[i % LINE_COLORS.length] },
        itemStyle: { color: LINE_COLORS[i % LINE_COLORS.length], borderColor: '#fff', borderWidth: 2 },
      })),
    };
  }, [seriesData, selectedYears, selectedMonths]);

  const option = useMemo(() => {
    if (filtered.length === 0) return null;

    if (compareByYear) {
      // One trend line per year; x-axis = the selected month names in calendar order
      const years = [...new Set(filtered.map((d) => d.month.split('-')[0]))].sort();
      const monthsInData = [...new Set(filtered.map((d) => Number(d.month.split('-')[1])))].sort((a, b) => a - b);
      const xLabels = monthsInData.map((m) => MONTH_NAMES[m - 1]);
      const valueMap = new Map(filtered.map((d) => [d.month, d]));

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
          data: xLabels,
          axisLabel: { fontSize: 10, color: '#64748b', interval: 0 },
        },
        yAxis: {
          type: 'value',
          axisLabel: { fontSize: 11, color: '#64748b', formatter: fmtCompact },
          splitLine: { lineStyle: { color: '#f1f5f9' } },
        },
        series: years.map((y, i) => ({
          name: y,
          type: 'line',
          connectNulls: true,
          data: monthsInData.map((m) => {
            const key = `${y}-${String(m).padStart(2, '0')}`;
            const d = valueMap.get(key);
            return d ? Math.round(d.totalValue) : null;
          }),
          symbolSize: 7,
          lineStyle: { width: 2.5, color: LINE_COLORS[i % LINE_COLORS.length] },
          itemStyle: { color: LINE_COLORS[i % LINE_COLORS.length], borderColor: '#fff', borderWidth: 2 },
        })),
      };
    }

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const d = filtered[params[0].dataIndex];
          return `<b>${monthLabel(d.month)}</b><br/>Value: ${fmtInr(d.totalValue)}<br/>Qty: ${Math.round(d.totalQuantity ?? 0).toLocaleString('en-IN')}<br/>Records: ${d.count ?? 0}`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '12%', top: 30, containLabel: true },
      xAxis: {
        type: 'category',
        data: filtered.map((d) => monthLabel(d.month)),
        axisLabel: { fontSize: 9, color: '#64748b', interval: 0, rotate: 35 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 11, color: '#64748b', formatter: fmtCompact },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      series: [
        {
          name: 'Value',
          type: 'line',
          data: filtered.map((d) => Math.round(d.totalValue)),
          symbolSize: 7,
          lineStyle: { width: 2.5, color: '#0891b2' },
          itemStyle: { color: '#0891b2', borderColor: '#fff', borderWidth: 2 },
          areaStyle: { color: 'rgba(8,145,178,0.08)' },
        },
      ],
    };
  }, [filtered, compareByYear]);

  const finalOption = multiOption ?? option;
  if (!finalOption) return null;

  return (
    <ChartContainer title={title} subtitle={subtitle} index={index}>
      <ReactEChartsCore echarts={echarts} option={finalOption} style={{ height }} opts={{ renderer: 'canvas' }} notMerge />
    </ChartContainer>
  );
}
