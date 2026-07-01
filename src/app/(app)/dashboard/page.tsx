'use client';

import { useMemo, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import {
  BarChart,
  PieChart,
  LineChart,
} from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { motion } from 'framer-motion';
import {
  IndianRupee,
  Package,
  AlertTriangle,
  Ship,
  RefreshCw,
  Clock,
} from 'lucide-react';

import { useDashboardSummary, type DashboardSummary } from '@/hooks/use-data';
import { KPICard } from '@/components/shared/kpi-card';
import { ChartContainer } from '@/components/shared/chart-container';
import { PageHeader } from '@/components/shared/page-header';
import { KPISkeleton, ChartSkeleton } from '@/components/shared/loading-skeleton';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber, formatCompact } from '@/lib/formatters';

echarts.use([
  BarChart,
  PieChart,
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

const COLORS = [
  '#4f46e5', '#0891b2', '#7c3aed', '#059669', '#d97706', '#e11d48',
];

const AXIS_STYLE = {
  axisLine: { lineStyle: { color: '#e2e8f0' } },
  axisTick: { show: false },
  axisLabel: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'var(--font-geist-sans), sans-serif',
  },
  splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' as const } },
};

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(255, 255, 255, 0.98)',
  borderColor: '#e2e8f0',
  borderWidth: 1,
  textStyle: {
    color: '#1e293b',
    fontSize: 12,
    fontFamily: 'var(--font-geist-sans), sans-serif',
  },
  extraCssText: 'backdrop-filter: blur(12px); border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);',
};

const LEGEND_STYLE = {
  textStyle: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'var(--font-geist-sans), sans-serif',
  },
  icon: 'roundRect' as const,
  itemWidth: 12,
  itemHeight: 8,
  itemGap: 16,
};

function buildDonutOption(data: DashboardSummary['inventory']['inventoryByType']): echarts.EChartsCoreOption {
  const chartData = data.length > 0
    ? data.map((d, i) => ({
        name: d.type || 'Unknown',
        value: d.totalValue,
        itemStyle: { color: COLORS[i % COLORS.length] },
      }))
    : [{ name: 'No Data', value: 1, itemStyle: { color: '#f1f5f9' } }];

  return {
    tooltip: {
      ...TOOLTIP_STYLE,
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number };
        return `<div style="font-weight:600;margin-bottom:4px;color:#1e293b">${p.name}</div>
                <div style="color:#64748b">Value: <span style="color:#1e293b;font-weight:500">${formatCurrency(p.value)}</span></div>
                <div style="color:#64748b">Share: <span style="color:#1e293b;font-weight:500">${p.percent?.toFixed(1)}%</span></div>`;
      },
    },
    legend: {
      ...LEGEND_STYLE,
      orient: 'vertical' as const,
      right: 10,
      top: 'center',
    },
    series: [
      {
        type: 'pie',
        radius: ['50%', '75%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: true,
        padAngle: 2,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#ffffff',
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 'bold',
            color: '#1e293b',
          },
          itemStyle: {
            shadowBlur: 16,
            shadowColor: 'rgba(0, 0, 0, 0.1)',
          },
        },
        data: chartData,
        animationType: 'scale' as const,
        animationEasing: 'elasticOut' as const,
        animationDelay: () => Math.random() * 200,
      },
    ],
  };
}

function buildAgeingBarOption(buckets: DashboardSummary['ageing']['buckets']): echarts.EChartsCoreOption {
  const filtered = buckets.filter((b) => b.bucket !== 'Unknown');
  const labels = filtered.map((b) => b.bucket);
  const values = filtered.map((b) => b.totalValue);

  return {
    tooltip: {
      ...TOOLTIP_STYLE,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(79,70,229,0.04)' } },
      formatter: (params: unknown) => {
        const p = (params as { name: string; value: number; dataIndex: number }[])[0];
        const bucket = filtered[p.dataIndex];
        return `<div style="font-weight:600;margin-bottom:4px;color:#1e293b">${p.name}</div>
                <div style="color:#64748b">Value: <span style="color:#1e293b;font-weight:500">${formatCurrency(p.value)}</span></div>
                <div style="color:#64748b">Items: <span style="color:#1e293b;font-weight:500">${formatNumber(bucket?.count ?? 0)}</span></div>
                <div style="color:#64748b">Share: <span style="color:#1e293b;font-weight:500">${bucket?.percentage?.toFixed(1) ?? 0}%</span></div>`;
      },
    },
    grid: { left: 10, right: 20, top: 20, bottom: 10, containLabel: true },
    xAxis: { type: 'category', data: labels, ...AXIS_STYLE },
    yAxis: {
      type: 'value',
      ...AXIS_STYLE,
      axisLabel: {
        ...AXIS_STYLE.axisLabel,
        formatter: (val: number) => formatCompact(val),
      },
    },
    series: [
      {
        type: 'bar',
        data: values.map((v, i) => ({
          value: v,
          itemStyle: {
            color: COLORS[i % COLORS.length],
            borderRadius: [4, 4, 0, 0],
          },
        })),
        barWidth: '50%',
        animationDelay: (idx: number) => idx * 100,
      },
    ],
    animationEasing: 'cubicOut',
  };
}

function buildMonthlyValueOption(
  periods: DashboardSummary['inventory']['periodSummaries']
): echarts.EChartsCoreOption {
  const labels = periods.map((p) => p.period);
  const values = periods.map((p) => p.totalValue);
  const stocks = periods.map((p) => p.totalStock);

  return {
    tooltip: {
      ...TOOLTIP_STYLE,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    legend: { ...LEGEND_STYLE, top: 0, right: 0 },
    grid: { left: 10, right: 10, top: 40, bottom: 10, containLabel: true },
    xAxis: { type: 'category', data: labels, ...AXIS_STYLE },
    yAxis: [
      {
        type: 'value',
        name: 'Value (₹)',
        nameTextStyle: { color: '#64748b', fontSize: 10 },
        ...AXIS_STYLE,
        axisLabel: {
          ...AXIS_STYLE.axisLabel,
          formatter: (val: number) => formatCompact(val),
        },
      },
      {
        type: 'value',
        name: 'Stock Qty',
        nameTextStyle: { color: '#64748b', fontSize: 10 },
        ...AXIS_STYLE,
        axisLabel: {
          ...AXIS_STYLE.axisLabel,
          formatter: (val: number) => formatCompact(val),
        },
      },
    ],
    series: [
      {
        name: 'Inventory Value',
        type: 'bar',
        yAxisIndex: 0,
        data: values,
        itemStyle: { color: '#4f46e5', borderRadius: [4, 4, 0, 0] },
        barWidth: '30%',
        barGap: '20%',
      },
      {
        name: 'Stock Quantity',
        type: 'bar',
        yAxisIndex: 1,
        data: stocks,
        itemStyle: { color: '#0891b2', borderRadius: [4, 4, 0, 0] },
        barWidth: '30%',
      },
    ],
    animationEasing: 'cubicOut',
  };
}

function buildStorageLocationOption(
  locations: DashboardSummary['ageing']['storageLocationAgeing']
): echarts.EChartsCoreOption {
  const labels = locations.map((l) => l.storageLocation);
  const values = locations.map((l) => l.totalValue);

  return {
    tooltip: {
      ...TOOLTIP_STYLE,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const p = (params as { name: string; value: number; dataIndex: number }[])[0];
        const loc = locations[p.dataIndex];
        return `<div style="font-weight:600;margin-bottom:4px;color:#1e293b">${p.name}</div>
                <div style="color:#64748b">Value: <span style="color:#1e293b;font-weight:500">${formatCurrency(p.value)}</span></div>
                <div style="color:#64748b">Avg Age: <span style="color:#1e293b;font-weight:500">${loc?.avgAge ?? 0} days</span></div>
                <div style="color:#64748b">Materials: <span style="color:#1e293b;font-weight:500">${loc?.materialCount ?? 0}</span></div>`;
      },
    },
    grid: { left: 10, right: 20, top: 20, bottom: 10, containLabel: true },
    xAxis: { type: 'category', data: labels, ...AXIS_STYLE, axisLabel: { ...AXIS_STYLE.axisLabel, rotate: 30 } },
    yAxis: {
      type: 'value',
      ...AXIS_STYLE,
      axisLabel: { ...AXIS_STYLE.axisLabel, formatter: (val: number) => formatCompact(val) },
    },
    series: [
      {
        type: 'bar',
        data: values.map((v, i) => ({
          value: v,
          itemStyle: { color: COLORS[i % COLORS.length], borderRadius: [4, 4, 0, 0] },
        })),
        barWidth: '50%',
      },
    ],
    animationEasing: 'cubicOut',
  };
}

function buildGitAgeingOption(
  buckets: DashboardSummary['importStats']['gitAgeingBuckets']
): echarts.EChartsCoreOption {
  const labels = buckets.map((b) => b.bucket);
  const values = buckets.map((b) => b.totalValue);

  return {
    tooltip: {
      ...TOOLTIP_STYLE,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const p = (params as { name: string; value: number; dataIndex: number }[])[0];
        const bucket = buckets[p.dataIndex];
        return `<div style="font-weight:600;margin-bottom:4px;color:#1e293b">${p.name}</div>
                <div style="color:#64748b">Value: <span style="color:#1e293b;font-weight:500">${formatCurrency(p.value)}</span></div>
                <div style="color:#64748b">Invoices: <span style="color:#1e293b;font-weight:500">${bucket?.invoiceCount ?? 0}</span></div>
                <div style="color:#64748b">Qty: <span style="color:#1e293b;font-weight:500">${formatNumber(bucket?.totalQuantity ?? 0)}</span></div>`;
      },
    },
    grid: { left: 10, right: 20, top: 20, bottom: 10, containLabel: true },
    xAxis: { type: 'category', data: labels, ...AXIS_STYLE },
    yAxis: {
      type: 'value',
      ...AXIS_STYLE,
      axisLabel: { ...AXIS_STYLE.axisLabel, formatter: (val: number) => formatCompact(val) },
    },
    series: [
      {
        type: 'bar',
        data: values.map((v, i) => ({
          value: v,
          itemStyle: {
            color: i === labels.length - 1 ? '#e11d48' : COLORS[i % COLORS.length],
            borderRadius: [4, 4, 0, 0],
          },
        })),
        barWidth: '50%',
      },
    ],
    animationEasing: 'cubicOut',
  };
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, dataUpdatedAt } = useDashboardSummary();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    setIsRefreshing(false);
  }, [queryClient]);

  const kpis = useMemo(() => {
    if (!data) return null;
    const { inventory, importStats } = data;
    return {
      totalInventoryValue: inventory.totalValue,
      totalStock: inventory.totalStock,
      importValue: importStats.totalImportValue,
    };
  }, [data]);

  const lastRefreshed = useMemo(() => {
    if (!dataUpdatedAt) return null;
    return new Date(dataUpdatedAt).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, [dataUpdatedAt]);

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-rose-500" />
          <h3 className="text-lg font-semibold text-foreground">Failed to load dashboard</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={handleRefresh}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Inventory Analytics Dashboard"
        description="Sona Comstar — Real-time inventory analytics & decision support"
        actions={
          <div className="flex items-center gap-3">
            {lastRefreshed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <Clock className="h-3 w-3" />
                Last refreshed: {lastRefreshed}
              </motion.div>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* KPI Cards — 3 cards in a single row */}
      {isLoading || !kpis ? (
        <KPISkeleton count={3} className="!grid-cols-1 sm:!grid-cols-3" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KPICard label="Total Inventory Value" value={kpis.totalInventoryValue} format="currency" icon={IndianRupee} color="blue" index={0} />
          <KPICard label="Total Inventory Qty" value={kpis.totalStock} format="number" icon={Package} color="cyan" index={1} />
          <KPICard label="Import Value (GIT)" value={kpis.importValue} format="currency" icon={Ship} color="amber" index={2} />
        </div>
      )}

      {/* Chart Row 1: Inventory by Type + Storage Age Distribution */}
      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartContainer title="Inventory Value by Type" subtitle="Distribution across inventory classification types" index={0}>
            <ReactEChartsCore echarts={echarts} option={buildDonutOption(data.inventory.inventoryByType)} style={{ height: 320 }} opts={{ renderer: 'canvas' }} notMerge />
          </ChartContainer>
          <ChartContainer title="Storage Age Distribution" subtitle="Value breakdown by aging buckets (GR Issue Date)" index={1}>
            <ReactEChartsCore echarts={echarts} option={buildAgeingBarOption(data.ageing.buckets)} style={{ height: 320 }} opts={{ renderer: 'canvas' }} notMerge />
          </ChartContainer>
        </div>
      )}

      {/* Chart Row 2: Monthly Comparison + Storage Location Analytics */}
      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartContainer title="Monthly Inventory Comparison" subtitle="Value and quantity across available periods" index={2}>
            <ReactEChartsCore echarts={echarts} option={buildMonthlyValueOption(data.inventory.periodSummaries)} style={{ height: 360 }} opts={{ renderer: 'canvas' }} notMerge />
          </ChartContainer>
          <ChartContainer title="Storage Location Analytics" subtitle="Inventory value by storage location" index={3}>
            <ReactEChartsCore echarts={echarts} option={buildStorageLocationOption(data.ageing.storageLocationAgeing)} style={{ height: 360 }} opts={{ renderer: 'canvas' }} notMerge />
          </ChartContainer>
        </div>
      )}

      {/* Chart Row 3: GIT Ageing Analysis (full width) */}
      {isLoading || !data ? (
        <ChartSkeleton />
      ) : (
        <ChartContainer title="GIT Ageing Analysis" subtitle="In-transit inventory by age bucket (Invoice Date)" index={4}>
          <ReactEChartsCore echarts={echarts} option={buildGitAgeingOption(data.importStats.gitAgeingBuckets)} style={{ height: 320 }} opts={{ renderer: 'canvas' }} notMerge />
        </ChartContainer>
      )}
    </div>
  );
}
