import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, PieChart, LineChart } from 'echarts/charts';
import {
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { FileSpreadsheet, IndianRupee, Boxes, Layers, Timer, TrendingUp, Truck, Download } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/shared/PageHeader';
import { KPICard } from '../components/shared/KPICard';
import { ChartContainer } from '../components/shared/ChartContainer';
import { EmptyState } from '../components/shared/EmptyState';
import { PageSkeleton } from '../components/shared/LoadingSkeleton';

echarts.use([
  BarChart,
  PieChart,
  LineChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

const API_BASE = '';

function useSummaryReport() {
  return useQuery({
    queryKey: ['summary-report'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/summary-report`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load summary report');
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

function fmtInr(v) {
  if (v == null || Number.isNaN(v)) return '--';
  return `₹${Math.round(Number(v)).toLocaleString('en-IN')}`;
}
function fmtNum(v) {
  if (v == null || Number.isNaN(v)) return '--';
  return Math.round(Number(v)).toLocaleString('en-IN');
}
function fmtPct(v) {
  if (v == null || Number.isNaN(v)) return '--';
  return `${Math.round(Number(v))}%`;
}

const BUCKET_COLORS = ['#10b981', '#22c55e', '#eab308', '#f97316', '#ef4444', '#7f1d1d'];

export default function SummaryReportPage() {
  const { data, isLoading, isError, error } = useSummaryReport();
  const [productFilter, setProductFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('all'); // all | opening | closing
  const [yearFilter, setYearFilter] = useState('2026');

  const inv = data?.inventorySummary ?? { products: [], overall: {} };
  const ageing = data?.ageingSummary ?? { bucketNames: [], products: [], grandTotal: null };
  const git = data?.gitSummary ?? { buckets: [], grandTotal: null };
  const periodLabels = data?.periodLabels ?? { opening: 'Opening', closing: 'Closing' };

  const productOptions = useMemo(() => {
    const set = new Set();
    inv.products.forEach((p) => set.add(p.productType));
    ageing.products.forEach((p) => set.add(p.productType));
    return Array.from(set);
  }, [inv.products, ageing.products]);

  const filteredInv = useMemo(() => {
    if (!productFilter) return inv.products;
    return inv.products.filter((p) => p.productType === productFilter);
  }, [inv.products, productFilter]);

  const filteredAgeing = useMemo(() => {
    if (!productFilter) return ageing.products;
    return ageing.products.filter((p) => p.productType === productFilter);
  }, [ageing.products, productFilter]);

  // KPIs — recomputed as filtered sums from the Excel-derived rows (no re-calculation of source data).
  const kpis = useMemo(() => {
    const showOpening = monthFilter === 'all' || monthFilter === 'opening';
    const showClosing = monthFilter === 'all' || monthFilter === 'closing';

    // Inventory qty/value from filtered inv rows
    const totalOpeningQty = filteredInv.reduce((s, p) => s + p.openingStock, 0);
    const totalClosingQty = filteredInv.reduce((s, p) => s + p.closingStock, 0);
    const totalOpeningVal = filteredInv.reduce((s, p) => s + p.openingValue, 0);
    const totalClosingVal = filteredInv.reduce((s, p) => s + p.closingValue, 0);

    let invQty = 0;
    let invVal = 0;
    if (showOpening && showClosing) {
      // "All Months" → show closing (yearly ending position)
      invQty = totalClosingQty;
      invVal = totalClosingVal;
    } else if (showOpening) {
      invQty = totalOpeningQty;
      invVal = totalOpeningVal;
    } else {
      invQty = totalClosingQty;
      invVal = totalClosingVal;
    }

    // Ageing avg age from bucket midpoints — weighted by value
    const midpoints = { '0-30 Days': 15, '31-60 Days': 45, '61-90 Days': 75, '91-180 Days': 135, '181-365 Days': 273, '>365 Days': 500 };
    let ageWeightedSum = 0;
    let ageTotalVal = 0;
    filteredAgeing.forEach((p) => {
      Object.entries(p.buckets).forEach(([b, v]) => {
        ageWeightedSum += (midpoints[b] ?? 0) * v;
        ageTotalVal += v;
      });
    });
    const avgInventoryAge = ageTotalVal > 0 ? ageWeightedSum / ageTotalVal : 0;

    // GIT KPIs — always sourced from the git sheet (product filter doesn't apply here)
    const gitQty = git.grandTotal?.qty ?? 0;
    const gitVal = git.grandTotal?.value ?? 0;
    const gitMid = { '0-30 Days': 15, '31-60 Days': 45, '61-90 Days': 75, '>90 Days': 120 };
    let gitAgeSum = 0;
    let gitAgeTotal = 0;
    git.buckets.forEach((b) => {
      gitAgeSum += (gitMid[b.bucket] ?? 0) * b.value;
      gitAgeTotal += b.value;
    });
    const avgGitAge = gitAgeTotal > 0 ? gitAgeSum / gitAgeTotal : 0;

    return {
      totalTypes: filteredInv.length || productOptions.length,
      invQty,
      invVal,
      gitQty,
      gitVal,
      avgInventoryAge,
      avgGitAge,
    };
  }, [filteredInv, filteredAgeing, git, monthFilter, productOptions.length]);

  const monthOptions = [
    { value: 'all', label: 'All Months' },
    { value: 'opening', label: periodLabels.opening },
    { value: 'closing', label: periodLabels.closing },
  ];

  // --- Charts ---
  const valueComparisonOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      legend: { data: [periodLabels.opening, periodLabels.closing], bottom: 0 },
      grid: { left: '3%', right: '4%', top: '5%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', data: filteredInv.map((p) => p.productType) },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v) => (v >= 10000000 ? `${(v / 10000000).toFixed(1)}Cr` : v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${v}`),
        },
      },
      series: [
        { name: periodLabels.opening, type: 'bar', data: filteredInv.map((p) => p.openingValue), itemStyle: { color: '#94a3b8', borderRadius: [6, 6, 0, 0] } },
        { name: periodLabels.closing, type: 'bar', data: filteredInv.map((p) => p.closingValue), itemStyle: { color: '#6366f1', borderRadius: [6, 6, 0, 0] } },
      ],
    }),
    [filteredInv, periodLabels]
  );

  const qtyComparisonOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      legend: { data: [periodLabels.opening, periodLabels.closing], bottom: 0 },
      grid: { left: '3%', right: '4%', top: '5%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', data: filteredInv.map((p) => p.productType) },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v) => (v >= 10000000 ? `${(v / 10000000).toFixed(1)}Cr` : v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${v}`),
        },
      },
      series: [
        { name: periodLabels.opening, type: 'bar', data: filteredInv.map((p) => p.openingStock), itemStyle: { color: '#94a3b8', borderRadius: [6, 6, 0, 0] } },
        { name: periodLabels.closing, type: 'bar', data: filteredInv.map((p) => p.closingStock), itemStyle: { color: '#0ea5e9', borderRadius: [6, 6, 0, 0] } },
      ],
    }),
    [filteredInv, periodLabels]
  );

  const productValuePieOption = useMemo(
    () => ({
      tooltip: { trigger: 'item', formatter: (p) => `${p.name}: ${fmtInr(p.value)} (${Math.round(p.percent)}%)` },
      legend: { bottom: 0 },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '45%'],
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { formatter: '{b}\n{d}%', fontSize: 11 },
          data: filteredInv.map((p) => ({
            name: p.productType,
            value: monthFilter === 'opening' ? p.openingValue : p.closingValue,
          })),
        },
      ],
    }),
    [filteredInv, monthFilter]
  );

  const productQtyBarOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', top: '5%', bottom: '10%', containLabel: true },
      xAxis: { type: 'category', data: filteredInv.map((p) => p.productType) },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'bar',
          data: filteredInv.map((p) => (monthFilter === 'opening' ? p.openingStock : p.closingStock)),
          itemStyle: { color: '#10b981', borderRadius: [6, 6, 0, 0] },
        },
      ],
    }),
    [filteredInv, monthFilter]
  );

  const ageingStackedOption = useMemo(() => {
    const buckets = ageing.bucketNames || [];
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (params) => {
        let s = `<b>${params[0].name}</b><br/>`;
        params.forEach((p) => { s += `${p.marker} ${p.seriesName}: ${fmtInr(p.value)}<br/>`; });
        return s;
      } },
      legend: { data: buckets, bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: '3%', right: '4%', top: '5%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', data: filteredAgeing.map((p) => p.productType) },
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
        data: filteredAgeing.map((p) => p.buckets[b] ?? 0),
        itemStyle: { color: BUCKET_COLORS[i] },
      })),
    };
  }, [filteredAgeing, ageing.bucketNames]);

  const gitBucketOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis', formatter: (p) => `<b>${p[0].name}</b><br/>Value: ${fmtInr(p[0].value)}` },
      grid: { left: '3%', right: '4%', top: '5%', bottom: '10%', containLabel: true },
      xAxis: { type: 'category', data: git.buckets.map((b) => b.bucket) },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v) => (v >= 10000000 ? `${(v / 10000000).toFixed(1)}Cr` : v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${v}`),
        },
      },
      series: [
        {
          type: 'bar',
          data: git.buckets.map((b) => b.value),
          itemStyle: { color: '#06b6d4', borderRadius: [6, 6, 0, 0] },
        },
      ],
    }),
    [git.buckets]
  );

  const monthlyInventoryTrendOption = useMemo(() => {
    // Trend from the two source months (Opening/Closing) — the Excel exposes only these two.
    const openTotal = filteredInv.reduce((s, p) => s + p.openingValue, 0);
    const closeTotal = filteredInv.reduce((s, p) => s + p.closingValue, 0);
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', top: '5%', bottom: '10%', containLabel: true },
      xAxis: { type: 'category', data: [periodLabels.opening, periodLabels.closing] },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v) => (v >= 10000000 ? `${(v / 10000000).toFixed(1)}Cr` : v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${v}`),
        },
      },
      series: [
        {
          type: 'line',
          smooth: true,
          data: [openTotal, closeTotal],
          areaStyle: { opacity: 0.2 },
          itemStyle: { color: '#6366f1' },
        },
      ],
    };
  }, [filteredInv, periodLabels]);

  const monthlyGitTrendOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', top: '5%', bottom: '10%', containLabel: true },
      xAxis: { type: 'category', data: git.buckets.map((b) => b.bucket) },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v) => (v >= 10000000 ? `${(v / 10000000).toFixed(1)}Cr` : v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${v}`),
        },
      },
      series: [
        {
          type: 'line',
          smooth: true,
          data: git.buckets.map((b) => b.value),
          areaStyle: { opacity: 0.2 },
          itemStyle: { color: '#06b6d4' },
        },
      ],
    }),
    [git.buckets]
  );

  if (isLoading && !data) return <PageSkeleton />;
  if (isError)
    return (
      <EmptyState
        icon={FileSpreadsheet}
        title="Summary report not available"
        description={error?.message ?? 'Upload a SUMMARY FILE.xlsx via the Upload button to see the report.'}
      />
    );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6">
      <PageHeader
        title="Summary Report"
        description={`Values sourced directly from ${data?.sourceFile ?? 'the uploaded summary Excel'} — matched to the workbook exactly.`}
        actions={
          <Button variant="outline" size="sm" onClick={async () => {
            const params = new URLSearchParams({
              year: yearFilter,
              month: monthFilter === 'all' ? 'All' : (monthFilter === 'opening' ? periodLabels.opening : periodLabels.closing),
              productType: productFilter || 'All',
            });
            const res = await fetch(`${API_BASE}/api/summary-export?${params.toString()}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Sona_Summary_Report.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}>
            <Download className="h-4 w-4 mr-1.5" /> Export XLSX
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end rounded-xl border border-border/50 bg-card p-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase text-muted-foreground">Year</label>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
            <option value="2026">2026</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase text-muted-foreground">Month</label>
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase text-muted-foreground">Product Type</label>
          <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
            <option value="">All Products</option>
            {productOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => { setProductFilter(''); setMonthFilter('all'); setYearFilter('2026'); }}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted"
        >
          Reset
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <KPICard label="Total Inventory Qty" value={kpis.invQty} format="number" icon={Boxes} color="blue" index={0} />
        <KPICard label="Total Inventory Value" value={kpis.invVal} format="currency" icon={IndianRupee} color="emerald" index={1} />
        <KPICard label="Total GIT Value" value={kpis.gitVal} format="currency" icon={Truck} color="cyan" index={2} />
        <KPICard label="Total GIT Qty" value={kpis.gitQty} format="number" icon={Boxes} color="purple" index={3} />
        <KPICard label="Product Types" value={kpis.totalTypes} format="number" icon={Layers} color="amber" index={4} />
        <KPICard label="Avg Inventory Age" value={Math.round(kpis.avgInventoryAge)} format="number" icon={Timer} color="orange" index={5} />
        <KPICard label="Avg GIT Age" value={Math.round(kpis.avgGitAge)} format="number" icon={Timer} color="rose" index={6} />
      </div>

      {/* Inventory Summary Table */}
      <section className="rounded-xl border border-border/50 bg-card p-5">
        <h2 className="mb-3 text-base font-semibold">Inventory Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border/50">
              <tr>
                <th className="py-2 px-2 text-left">Product Type</th>
                <th className="py-2 px-2 text-right">{periodLabels.opening} Stock</th>
                <th className="py-2 px-2 text-right">{periodLabels.closing} Stock</th>
                <th className="py-2 px-2 text-right">Difference</th>
                <th className="py-2 px-2 text-right">% Change</th>
                <th className="py-2 px-2 text-right">{periodLabels.opening} Value</th>
                <th className="py-2 px-2 text-right">{periodLabels.closing} Value</th>
                <th className="py-2 px-2 text-right">Value Difference</th>
                <th className="py-2 px-2 text-right">% Value Change</th>
              </tr>
            </thead>
            <tbody>
              {filteredInv.map((p) => (
                <tr key={p.productType} className="border-b border-border/30 hover:bg-muted/30">
                  <td className="py-2 px-2 font-medium">{p.productType}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtNum(p.openingStock)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtNum(p.closingStock)}</td>
                  <td className={`py-2 px-2 text-right tabular-nums ${p.stockDifference >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtNum(p.stockDifference)}</td>
                  <td className={`py-2 px-2 text-right tabular-nums ${p.percentStockChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtPct(p.percentStockChange)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtInr(p.openingValue)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtInr(p.closingValue)}</td>
                  <td className={`py-2 px-2 text-right tabular-nums ${p.valueDifference >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtInr(p.valueDifference)}</td>
                  <td className={`py-2 px-2 text-right tabular-nums ${p.percentValueChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtPct(p.percentValueChange)}</td>
                </tr>
              ))}
            </tbody>
            {inv.overall?.stockQty && (
              <tfoot className="text-sm font-semibold border-t border-border/50 bg-muted/30">
                <tr>
                  <td className="py-2 px-2">Total Stock Qty</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtNum(inv.overall.stockQty.opening)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtNum(inv.overall.stockQty.closing)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtNum(inv.overall.stockQty.difference)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtPct(inv.overall.stockQty.percentChange)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtInr(inv.overall.stockValue.opening)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtInr(inv.overall.stockValue.closing)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtInr(inv.overall.stockValue.difference)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtPct(inv.overall.stockValue.percentChange)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Inventory Value Comparison" subtitle={`${periodLabels.opening} vs ${periodLabels.closing}`} index={0}>
          <ReactEChartsCore echarts={echarts} option={valueComparisonOption} style={{ height: 320 }} notMerge lazyUpdate />
        </ChartContainer>
        <ChartContainer title="Quantity Comparison" subtitle={`${periodLabels.opening} vs ${periodLabels.closing}`} index={1}>
          <ReactEChartsCore echarts={echarts} option={qtyComparisonOption} style={{ height: 320 }} notMerge lazyUpdate />
        </ChartContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Product-wise Inventory Value" subtitle={monthFilter === 'opening' ? periodLabels.opening : periodLabels.closing} index={2}>
          <ReactEChartsCore echarts={echarts} option={productValuePieOption} style={{ height: 320 }} notMerge lazyUpdate />
        </ChartContainer>
        <ChartContainer title="Product-wise Quantity" subtitle={monthFilter === 'opening' ? periodLabels.opening : periodLabels.closing} index={3}>
          <ReactEChartsCore echarts={echarts} option={productQtyBarOption} style={{ height: 320 }} notMerge lazyUpdate />
        </ChartContainer>
      </div>

      {/* Ageing Summary */}
      <section className="rounded-xl border border-border/50 bg-card p-5">
        <h2 className="mb-3 text-base font-semibold">Inventory Ageing Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border/50">
              <tr>
                <th className="py-2 px-2 text-left">Product Type</th>
                {ageing.bucketNames.map((b) => (
                  <th key={b} className="py-2 px-2 text-right">{b}</th>
                ))}
                <th className="py-2 px-2 text-right">Grand Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgeing.map((p) => (
                <tr key={p.productType} className="border-b border-border/30 hover:bg-muted/30">
                  <td className="py-2 px-2 font-medium">{p.productType}</td>
                  {ageing.bucketNames.map((b) => (
                    <td key={b} className="py-2 px-2 text-right tabular-nums">{fmtInr(p.buckets[b])}</td>
                  ))}
                  <td className="py-2 px-2 text-right tabular-nums font-semibold">{fmtInr(p.total)}</td>
                </tr>
              ))}
            </tbody>
            {ageing.grandTotal && (
              <tfoot className="text-sm font-semibold border-t border-border/50 bg-muted/30">
                <tr>
                  <td className="py-2 px-2">Grand Total</td>
                  {ageing.bucketNames.map((b) => (
                    <td key={b} className="py-2 px-2 text-right tabular-nums">{fmtInr(ageing.grandTotal.buckets[b])}</td>
                  ))}
                  <td className="py-2 px-2 text-right tabular-nums">{fmtInr(ageing.grandTotal.total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <ChartContainer title="Product-wise Ageing" subtitle="Stacked value by bucket per product" index={4}>
        <ReactEChartsCore echarts={echarts} option={ageingStackedOption} style={{ height: 380 }} notMerge lazyUpdate />
      </ChartContainer>

      {/* GIT Summary */}
      <section className="rounded-xl border border-border/50 bg-card p-5">
        <h2 className="mb-3 text-base font-semibold">GIT Analysis</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border/50">
              <tr>
                <th className="py-2 px-2 text-left">Age Bucket</th>
                <th className="py-2 px-2 text-right">Sum of Qty</th>
                <th className="py-2 px-2 text-right">Sum of Value</th>
              </tr>
            </thead>
            <tbody>
              {git.buckets.map((b) => (
                <tr key={b.bucket} className="border-b border-border/30 hover:bg-muted/30">
                  <td className="py-2 px-2 font-medium">{b.bucket}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtNum(b.qty)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtInr(b.value)}</td>
                </tr>
              ))}
            </tbody>
            {git.grandTotal && (
              <tfoot className="text-sm font-semibold border-t border-border/50 bg-muted/30">
                <tr>
                  <td className="py-2 px-2">Grand Total</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtNum(git.grandTotal.qty)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtInr(git.grandTotal.value)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Monthly Inventory Trend" subtitle={`${periodLabels.opening} → ${periodLabels.closing}`} index={5}>
          <ReactEChartsCore echarts={echarts} option={monthlyInventoryTrendOption} style={{ height: 300 }} notMerge lazyUpdate />
        </ChartContainer>
        <ChartContainer title="Monthly GIT Trend" subtitle="Value by age bucket" index={6}>
          <ReactEChartsCore echarts={echarts} option={monthlyGitTrendOption} style={{ height: 300 }} notMerge lazyUpdate />
        </ChartContainer>
      </div>
    </motion.div>
  );
}
