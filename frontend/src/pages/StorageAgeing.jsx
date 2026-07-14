import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, PieChart } from 'echarts/charts';
import {
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import {
  Download,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  ShieldAlert,
  Timer,
  AlertTriangle,
  TrendingDown,
} from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { KPICard } from '../components/shared/KPICard';
import { ChartContainer } from '../components/shared/ChartContainer';
import { EmptyState } from '../components/shared/EmptyState';
import { PageSkeleton } from '../components/shared/LoadingSkeleton';
import { Button } from '../components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../components/ui/DropdownMenu';
import { useExportData, useDashboardSummary } from '../hooks/useData';
import { formatCurrency, formatNumber } from '../lib/formatters';
import { MultiSelect } from '../components/shared/MultiSelect';
import { MonthlyTrend } from '../components/shared/MonthlyTrend';
import { GlobalFilters } from '../components/shared/GlobalFilters';
import { useFilterStore } from '../store/filterStore';
import { useFilterOptions } from '../hooks/useFilters';
import { STORAGE_AGE_BUCKETS } from '../config/constants';

echarts.use([
  BarChart,
  PieChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

const BUCKET_COLORS = ['#10b981', '#22c55e', '#eab308', '#f97316', '#ef4444', '#7f1d1d', '#991b1b', '#78350f', '#365314', '#1e3a5f'];

const PIE_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#7c3aed',
  '#06b6d4', '#ea580c', '#db2777', '#65a30d', '#0891b2',
  '#9333ea', '#e11d48', '#ca8a04',
];

export default function StorageAgeingPage() {
  const { data: summary, isLoading, isError, error } = useDashboardSummary();
  const { data: filterOptions = {} } = useFilterOptions();
  const gf = useFilterStore();

  const exportMutation = useExportData();

  const handleExport = useCallback(
    (format) => {
      exportMutation.mutate({ module: 'ageing', format });
    },
    [exportMutation]
  );

  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedValueCols, setSelectedValueCols] = useState([]);

  const ageingBuckets = summary?.ageing?.buckets ?? [];
  const matrix = summary?.ageing?.storageAgeingMatrix ?? [];

  // Value column filter — Excel columns K, M, O, Q, S of the ageing report
  const VALUE_COLS = [
    { value: 'vUnrestricted', label: 'Value Unrestricted (K)' },
    { value: 'vTransit', label: 'Val. in Trans./Tfr (M)' },
    { value: 'vQualInsp', label: 'Value in QualInsp. (O)' },
    { value: 'vRestricted', label: 'Value Restricted (Q)' },
    { value: 'vBlocked', label: 'Value BlockedStock (S)' },
  ];

  const locationOptions = useMemo(
    () => [...new Set(matrix.map((r) => r.storageLocation))].sort(),
    [matrix]
  );
  const productTypeOptions = useMemo(
    () => [...new Set(matrix.map((r) => r.productType))].sort(),
    [matrix]
  );

  const rowValue = useMemo(() => {
    if (selectedValueCols.length === 0) return (r) => r.totalValue;
    return (r) => selectedValueCols.reduce((s, c) => s + (r[c] || 0), 0);
  }, [selectedValueCols]);

  // Aggregate matrix rows by location applying product/value-column filters
  const allStorageDetailed = useMemo(() => {
    const locMap = new Map();
    for (const r of matrix) {
      if (selectedProducts.length > 0 && !selectedProducts.includes(r.productType)) continue;
      let e = locMap.get(r.storageLocation);
      if (!e) {
        e = { storageLocation: r.storageLocation, totalValue: 0, totalQuantity: 0, bucketMap: new Map() };
        locMap.set(r.storageLocation, e);
      }
      const v = rowValue(r);
      e.totalValue += v;
      e.totalQuantity += r.totalQuantity;
      const b = e.bucketMap.get(r.bucket) ?? { bucket: r.bucket, count: 0, totalValue: 0, totalQuantity: 0 };
      b.count += r.count;
      b.totalValue += v;
      b.totalQuantity += r.totalQuantity;
      e.bucketMap.set(r.bucket, b);
    }
    return [...locMap.values()]
      .map((e) => ({
        storageLocation: e.storageLocation,
        totalValue: e.totalValue,
        totalQuantity: e.totalQuantity,
        buckets: STORAGE_AGE_BUCKETS.map((b) => e.bucketMap.get(b) ?? { bucket: b, count: 0, totalValue: 0, totalQuantity: 0 }),
      }))
      .sort((a, b) => a.storageLocation.localeCompare(b.storageLocation));
  }, [matrix, selectedProducts, rowValue]);

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const grTrendMatrix = summary?.ageing?.grTrendMatrix ?? [];

  // GR trend responds to Location + Product + Value Column filters too
  const grTrend = useMemo(() => {
    const map = new Map();
    for (const r of grTrendMatrix) {
      if (selectedLocations.length > 0 && !selectedLocations.includes(r.storageLocation)) continue;
      if (selectedProducts.length > 0 && !selectedProducts.includes(r.productType)) continue;
      const v = rowValue(r);
      const e = map.get(r.month) ?? { month: r.month, totalValue: 0, totalQuantity: 0, count: 0 };
      e.totalValue += v;
      e.totalQuantity += r.totalQuantity;
      e.count += r.count;
      map.set(r.month, e);
    }
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [grTrendMatrix, selectedLocations, selectedProducts, rowValue]);

  // When a filter has 2+ selections, split the trend into one line per selected
  // item (locations > products > value columns). Otherwise one line per year.
  const grSeriesData = useMemo(() => {
    const passes = (r) =>
      (selectedLocations.length === 0 || selectedLocations.includes(r.storageLocation)) &&
      (selectedProducts.length === 0 || selectedProducts.includes(r.productType));
    const agg = (keyFn, valFn) => {
      const map = new Map();
      for (const r of grTrendMatrix) {
        if (!passes(r)) continue;
        const series = keyFn(r);
        if (series == null) continue;
        const k = `${series}|${r.month}`;
        map.set(k, (map.get(k) ?? 0) + valFn(r));
      }
      return [...map.entries()].map(([k, value]) => {
        const [series, month] = k.split('|');
        return { series, month, value };
      });
    };
    if (selectedLocations.length >= 2) {
      return agg((r) => r.storageLocation, rowValue);
    }
    if (selectedProducts.length >= 2) {
      return agg((r) => r.productType, rowValue);
    }
    if (selectedValueCols.length >= 2) {
      const rows = [];
      for (const col of selectedValueCols) {
        const label = VALUE_COLS.find((c) => c.value === col)?.label ?? col;
        rows.push(...agg(() => label, (r) => r[col] || 0));
      }
      return rows;
    }
    return null;
  }, [grTrendMatrix, selectedLocations, selectedProducts, selectedValueCols, rowValue]);
  const grYearOptions = useMemo(
    () => [...new Set(grTrend.map((d) => d.month.split('-')[0]))].sort(),
    [grTrend]
  );
  const grMonthOptions = useMemo(
    () => [...new Set(grTrend.map((d) => MONTH_NAMES[Number(d.month.split('-')[1]) - 1]))],
    [grTrend]
  );

  const storageDetailed = useMemo(() => {
    if (selectedLocations.length === 0) return allStorageDetailed;
    return allStorageDetailed.filter((l) => selectedLocations.includes(l.storageLocation));
  }, [allStorageDetailed, selectedLocations]);

  const chartOption = useMemo(() => {
    const buckets = ageingBuckets.filter((b) => b.bucket !== 'Unknown');
    if (buckets.length === 0) return null;
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255,255,255,0.98)',
        borderColor: '#e2e8f0',
        textStyle: { color: '#1e293b', fontSize: 12 },
        formatter: (params) => {
          const p = params[0];
          return `<b>${p.name}</b><br/>Value: ${formatCurrency(p.value)}`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '8%', containLabel: true },
      xAxis: {
        type: 'category',
        data: buckets.map((b) => b.bucket),
        axisLabel: { color: '#64748b', fontSize: 9, interval: 0, rotate: 35 },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          formatter: (val) =>
            val >= 10000000
              ? `${(val / 10000000).toFixed(1)}Cr`
              : val >= 100000
                ? `${(val / 100000).toFixed(1)}L`
                : val >= 1000
                  ? `${(val / 1000).toFixed(0)}K`
                  : String(val),
        },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      series: [
        {
          name: 'Value',
          type: 'bar',
          data: buckets.map((b) => b.totalValue),
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#3b82f6' },
              { offset: 1, color: '#1e40af' },
            ]),
          },
          barWidth: '50%',
        },
      ],
    };
  }, [ageingBuckets]);

  const stackedByLocOption = useMemo(() => {
    if (storageDetailed.length === 0) return null;
    const buckets = STORAGE_AGE_BUCKETS;
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: buckets, bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: '3%', right: '4%', top: '5%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', data: storageDetailed.map((l) => l.storageLocation), axisLabel: { fontSize: 11 } },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v) => (v >= 10000000 ? `${(v / 10000000).toFixed(1)}Cr` : v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${v}`),
        },
      },
      series: buckets.map((b, i) => ({
        name: b,
        type: 'bar',
        stack: 'total',
        data: storageDetailed.map((l) => l.buckets.find((x) => x.bucket === b)?.totalValue ?? 0),
        itemStyle: { color: BUCKET_COLORS[i % BUCKET_COLORS.length] },
      })),
    };
  }, [storageDetailed]);

  const donutOption = useMemo(() => {
    if (storageDetailed.length === 0) return null;
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255,255,255,0.98)',
        borderColor: '#e2e8f0',
        textStyle: { color: '#1e293b', fontSize: 12 },
        formatter: (params) =>
          `<div style="font-weight:600;margin-bottom:4px">${params.name}</div>
           <div>Value: <b>${formatCurrency(params.value)}</b></div>
           <div>Share: <b>${params.percent.toFixed(1)}%</b></div>`,
      },
      legend: { orient: 'vertical', right: '5%', top: 'center', textStyle: { color: '#64748b', fontSize: 11 } },
      color: PIE_COLORS,
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        minAngle: 8,
        padAngle: 0,
        itemStyle: { borderRadius: 2, borderColor: '#fff', borderWidth: 1 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold', color: '#1e293b' } },
        data: storageDetailed.map((l) => ({
          name: l.storageLocation,
          value: l.totalValue,
        })),
      }],
    };
  }, [storageDetailed]);

  if (isLoading && !summary) {
    return <PageSkeleton />;
  }

  if (isError) {
    return (
      <EmptyState
        title="Error loading data"
        description={error instanceof Error ? error.message : 'An error occurred'}
        actionLabel="Retry"
        onAction={() => window.location.reload()}
      />
    );
  }

  const totalInventoryValue = summary?.ageing?.closingInventoryValue ?? 0;
  const totalUnrestricted = summary?.ageing?.totalUnrestrictedValue ?? 0;
  const deadStockValue = summary?.ageing?.deadStockValue ?? 0;
  const slowMovingValue = summary?.ageing?.slowMovingValue ?? 0;
  const avgAge = summary?.ageing?.avgInventoryAge ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <PageHeader
        title="Storage Ageing"
        description="Analyze storage age distribution based on GR Issue Date"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1.5" />
                  Export
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('xlsx')}>
                <FileSpreadsheet className="h-4 w-4" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <FileText className="h-4 w-4" />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* Global Filters */}
      <GlobalFilters
        filters={gf}
        onChange={(f) => gf.setFilters(f)}
        options={filterOptions}
      />

      {/* Chart-specific Filters */}
      <div className="flex flex-wrap gap-3 items-end rounded-xl border border-border/50 bg-card p-4">
        <MultiSelect label="Year" options={grYearOptions} selected={selectedYears} onChange={setSelectedYears} />
        <MultiSelect label="Month" options={grMonthOptions} selected={selectedMonths} onChange={setSelectedMonths} />
        <MultiSelect
          label="Storage Locations"
          options={locationOptions}
          selected={selectedLocations}
          onChange={setSelectedLocations}
          className="min-w-[180px]"
        />
        <MultiSelect
          label="Product Types"
          options={productTypeOptions}
          selected={selectedProducts}
          onChange={setSelectedProducts}
          className="min-w-[160px]"
        />
        <MultiSelect
          label="Value Columns"
          options={VALUE_COLS}
          selected={selectedValueCols}
          onChange={setSelectedValueCols}
          className="min-w-[200px]"
        />
        <p className="pb-2 text-xs text-muted-foreground">
          {storageDetailed.length} of {allStorageDetailed.length} locations shown — trend, charts &amp; table compare the selection
        </p>
      </div>

      <MonthlyTrend
        data={grTrend}
        seriesData={grSeriesData}
        selectedYears={selectedYears}
        selectedMonths={selectedMonths}
        title="Inventory Value Trend by GR Month"
        subtitle="Multiple lines: one per selected location/product/value column, or one per year"
        index={0}
        compareByYear
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard label="Total Inventory Value" value={totalInventoryValue} format="currency" icon={IndianRupee} color="emerald" index={0} />
        <KPICard label="Unrestricted Value" value={totalUnrestricted} format="currency" icon={ShieldAlert} color="blue" index={1} />
        <KPICard label="Dead Stock (>180d)" value={deadStockValue} format="currency" icon={AlertTriangle} color="orange" index={2} />
        <KPICard label="Slow Moving (90-180d)" value={slowMovingValue} format="currency" icon={TrendingDown} color="amber" index={3} />
        <KPICard label="Avg Inventory Age" value={avgAge} format="number" icon={Timer} color="purple" index={4} />
      </div>

      {/* Row 1: Age Bucket Distribution + Top Locations Donut */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {chartOption && (
          <ChartContainer title="Value by Aging Bucket" subtitle="Distribution of inventory value across aging periods" index={0}>
            <ReactEChartsCore echarts={echarts} option={chartOption} style={{ height: 320 }} notMerge lazyUpdate />
          </ChartContainer>
        )}
        {donutOption && (
          <ChartContainer title="Top Storage Locations" subtitle="Inventory value share by storage location" index={1}>
            <ReactEChartsCore echarts={echarts} option={donutOption} style={{ height: 320 }} notMerge lazyUpdate />
          </ChartContainer>
        )}
      </div>

      {/* Row 2: Stacked bar by location */}
      {stackedByLocOption && (
        <ChartContainer title="Ageing by Storage Location" subtitle="Stacked value across age buckets per location" index={2}>
          <ReactEChartsCore echarts={echarts} option={stackedByLocOption} style={{ height: 380 }} notMerge lazyUpdate />
        </ChartContainer>
      )}

      {/* Storage Location Ageing Breakdown Table */}
      {storageDetailed.length > 0 && (
        <section className="rounded-xl border border-border/50 bg-card p-5">
          <h2 className="mb-3 text-base font-semibold">Storage Location Ageing Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border/50">
                <tr>
                  <th className="py-2 px-2 text-left">Storage Loc</th>
                  {STORAGE_AGE_BUCKETS.map((b) => (
                    <th key={b} className="py-2 px-2 text-right">{b}</th>
                  ))}
                  <th className="py-2 px-2 text-right">Grand Total</th>
                </tr>
              </thead>
              <tbody>
                {storageDetailed.map((l) => (
                  <tr key={l.storageLocation} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="py-2 px-2 font-medium">{l.storageLocation}</td>
                    {STORAGE_AGE_BUCKETS.map((b) => {
                      const bkt = l.buckets.find((x) => x.bucket === b);
                      return (
                        <td key={b} className="py-2 px-2 text-right tabular-nums">{formatCurrency(bkt?.totalValue ?? 0)}</td>
                      );
                    })}
                    <td className="py-2 px-2 text-right tabular-nums font-semibold text-emerald-600">{formatCurrency(l.totalValue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm font-semibold border-t border-border/50 bg-muted/30">
                <tr>
                  <td className="py-2 px-2">Grand Total</td>
                  {STORAGE_AGE_BUCKETS.map((b) => (
                    <td key={b} className="py-2 px-2 text-right tabular-nums">
                      {formatCurrency(storageDetailed.reduce((s, l) => s + (l.buckets.find((x) => x.bucket === b)?.totalValue ?? 0), 0))}
                    </td>
                  ))}
                  <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(storageDetailed.reduce((s, l) => s + l.totalValue, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </motion.div>
  );
}
