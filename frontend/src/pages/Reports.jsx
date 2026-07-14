import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  Download, FileText, FileSpreadsheet, Table2,
  BarChart3, Clock, Package, Truck, Layers,
  ChevronLeft, ChevronRight, RefreshCw, Database,
  AlertCircle, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, PieChart, LineChart } from 'echarts/charts';
import { TooltipComponent, GridComponent, LegendComponent, TitleComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { PageHeader } from '../components/shared/PageHeader';
import { CalendarDateSelect } from '../components/shared/GlobalFilters';
import { ChartContainer } from '../components/shared/ChartContainer';
import { useDashboardSummary } from '../hooks/useData';

echarts.use([BarChart, PieChart, LineChart, TooltipComponent, GridComponent, LegendComponent, TitleComponent, CanvasRenderer]);

const API = 'http://localhost:5000';

const REPORT_TYPES = [
  { id: 'storage-ageing',     label: 'Storage Ageing',     icon: Clock,      color: 'text-cyan-600' },
  { id: 'product-ageing',     label: 'Product Analytics',  icon: Layers,     color: 'text-purple-600' },
  { id: 'closing-inventory',  label: 'Closing Inventory',  icon: Package,    color: 'text-blue-600' },
  { id: 'git',                label: 'GIT / In-Transit',   icon: Truck,      color: 'text-orange-600' },
  { id: 'inventory',          label: 'Raw Inventory',      icon: Database,   color: 'text-indigo-600' },
];

const AGE_BUCKET_KEYS = ['b_0_30','b_31_60','b_61_90','b_91_180','b_181_365','b_1yr','b_2yr','b_3yr','b_4yr','b_5yr'];
const AGE_BUCKET_LABELS = ['0-30','31-60','61-90','91-180','181-365','>1Yr','>2Yr','>3Yr','>4Yr','>5Yr'];

function fmtInr(v) {
  if (!v && v !== 0) return '—';
  const n = Number(v);
  if (n >= 10000000) return `₹${(n/10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n/100000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function fmtNum(v) { return v == null ? '—' : Number(v).toLocaleString('en-IN'); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-IN') : '—'; }

const COLORS = ['#4f46e5','#0891b2','#d97706','#059669','#e11d48','#7c3aed','#ca8a04','#0e7490','#16a34a','#dc2626'];

/* ── KPI card ─────────────────────────────────────────── */
function KPI({ label, value, sub, color = 'text-foreground' }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* ── Pagination ───────────────────────────────────────── */
function Pagination({ page, pages, onChange }) {
  return (
    <div className="flex items-center gap-2 mt-4 justify-end">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded border border-border p-1.5 disabled:opacity-40 hover:bg-muted/50"
      ><ChevronLeft className="size-4" /></button>
      <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
      <button
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        className="rounded border border-border p-1.5 disabled:opacity-40 hover:bg-muted/50"
      ><ChevronRight className="size-4" /></button>
    </div>
  );
}

/* ── filtersToParams ──────────────────────────────────── */
function filtersToParams(f) {
  const p = {};
  if (f.years?.length)      p.years      = JSON.stringify(f.years);
  if (f.months?.length)     p.months     = JSON.stringify(f.months);
  if (f.products?.length)   p.products   = JSON.stringify(f.products);
  if (f.locations?.length)  p.locations  = JSON.stringify(f.locations);
  if (f.materials?.length)  p.materials  = JSON.stringify(f.materials);
  if (f.dates?.length)     p.dates      = JSON.stringify(f.dates);
  if (f.days?.length)     p.days       = JSON.stringify(f.days);
  return p;
}

/* ── Storage Ageing panel ─────────────────────────────── */
function StorageAgeingPanel({ filters }) {
  const params = filtersToParams(filters);
  const { data, isLoading, error } = useQuery({
    queryKey: ['rpt-storage-ageing', params],
    queryFn: () => axios.get(`${API}/api/db/storage-ageing`, { params }).then((r) => r.data),
    staleTime: 30000,
  });

  if (isLoading) return <Loader />;
  if (error)     return <Err msg={error.message} />;
  const { kpis, byProduct = [], byBucket = [] } = data || {};

  const pieOpt = {
    tooltip: { formatter: (p) => `${p.name}: ${fmtInr(p.value)} (${p.percent}%)` },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['38%','65%'],
      data: byProduct.map((r, i) => ({ name: r.product_type, value: Number(r.total_value), itemStyle: { color: COLORS[i % COLORS.length] } })),
      label: { show: false },
    }],
  };

  const barOpt = {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '8%', top: 20, containLabel: true },
    xAxis: { type: 'category', data: AGE_BUCKET_LABELS, axisLabel: { fontSize: 10, color: '#64748b' } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#64748b', formatter: (v) => fmtInr(v) } },
    series: [{
      type: 'bar', barMaxWidth: 36,
      data: byBucket.map((r) => Number(r.total_value)),
      itemStyle: { color: '#4f46e5', borderRadius: [4,4,0,0] },
    }],
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPI label="Total Value"      value={fmtInr(kpis?.total_value)}      color="text-indigo-600" />
        <KPI label="Total Items"      value={fmtNum(kpis?.total_items)} />
        <KPI label="Avg Age"          value={`${kpis?.avg_age || 0} days`} />
        <KPI label="Dead Stock (>180d)" value={fmtInr(kpis?.dead_stock_value)} color="text-rose-600" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartContainer title="Product Distribution" index={0}>
          <ReactEChartsCore echarts={echarts} option={pieOpt} style={{ height: 280 }} opts={{ renderer: 'canvas' }} notMerge />
        </ChartContainer>
        <ChartContainer title="Age Bucket Distribution" index={1}>
          <ReactEChartsCore echarts={echarts} option={barOpt} style={{ height: 280 }} opts={{ renderer: 'canvas' }} notMerge />
        </ChartContainer>
      </div>
      <StorageMatrixTable data={data?.matrix || []} />
    </div>
  );
}

function StorageMatrixTable({ data }) {
  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of data) {
      if (!map.has(r.storage_location)) map.set(r.storage_location, []);
      map.get(r.storage_location).push(r);
    }
    return [...map.entries()].sort(([a],[b]) => a.localeCompare(b));
  }, [data]);

  if (!grouped.length) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            <th className="sticky left-0 bg-muted/90 px-3 py-2 text-left font-semibold">Location</th>
            <th className="px-3 py-2 text-left font-semibold">Product</th>
            {AGE_BUCKET_LABELS.map((l) => <th key={l} className="px-2 py-2 text-right font-semibold whitespace-nowrap">{l}</th>)}
            <th className="px-3 py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(([loc, rows]) =>
            rows.map((r, i) => (
              <tr key={`${loc}-${i}`} className="border-t border-border/40 hover:bg-muted/20">
                {i === 0 && (
                  <td rowSpan={rows.length} className="sticky left-0 bg-background px-3 py-2 font-medium border-r border-border/40 align-top">{loc}</td>
                )}
                <td className="px-3 py-1.5 text-muted-foreground">{r.product_type || '—'}</td>
                {AGE_BUCKET_KEYS.map((k) => (
                  <td key={k} className="px-2 py-1.5 text-right tabular-nums">
                    {Number(r[k]) > 0 ? fmtInr(r[k]) : <span className="text-muted-foreground/40">—</span>}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{fmtInr(r.total_value)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ── Product Ageing panel ─────────────────────────────── */
function ProductAgeingPanel({ filters }) {
  const params = filtersToParams(filters);
  const { data, isLoading, error } = useQuery({
    queryKey: ['rpt-product-ageing', params],
    queryFn: () => axios.get(`${API}/api/db/product-ageing`, { params }).then((r) => r.data),
    staleTime: 30000,
  });

  if (isLoading) return <Loader />;
  if (error)     return <Err msg={error.message} />;
  const { data: rows = [], grandTotal = 0 } = data || {};

  const barOpt = {
    tooltip: { trigger: 'axis', formatter: (p) => `${p[0].name}<br/>${fmtInr(p[0].value)}` },
    grid: { left: '3%', right: '4%', bottom: '8%', top: 20, containLabel: true },
    xAxis: { type: 'category', data: rows.map((r) => r.product_type), axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { formatter: fmtInr, fontSize: 10 } },
    series: [{ type: 'bar', data: rows.map((r, i) => ({ value: Number(r.total_value), itemStyle: { color: COLORS[i % COLORS.length], borderRadius: [4,4,0,0] } })) }],
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KPI label="Grand Total" value={fmtInr(grandTotal)} color="text-indigo-600" />
        <KPI label="Product Types" value={rows.length} />
        <KPI label="Avg Age" value={rows.length ? `${Math.round(rows.reduce((s,r) => s+Number(r.avg_age||0), 0) / rows.length)}d` : '—'} />
      </div>
      <ChartContainer title="Value by Product Type" index={0}>
        <ReactEChartsCore echarts={echarts} option={barOpt} style={{ height: 280 }} opts={{ renderer: 'canvas' }} notMerge />
      </ChartContainer>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left">Product Type</th>
              {AGE_BUCKET_LABELS.map((l) => <th key={l} className="px-2 py-2 text-right whitespace-nowrap">{l}</th>)}
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Materials</th>
              <th className="px-3 py-2 text-right">Avg Age</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.product_type} className="border-t border-border/40 hover:bg-muted/20">
                <td className="px-3 py-1.5 font-medium">{r.product_type}</td>
                {AGE_BUCKET_KEYS.map((k) => (
                  <td key={k} className="px-2 py-1.5 text-right tabular-nums">
                    {Number(r[k]) > 0 ? fmtInr(r[k]) : <span className="text-muted-foreground/40">—</span>}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right font-semibold">{fmtInr(r.total_value)}</td>
                <td className="px-3 py-1.5 text-right">{r.material_count}</td>
                <td className="px-3 py-1.5 text-right">{r.avg_age}d</td>
              </tr>
            ))}
            <tr className="border-t-2 border-border bg-muted/30 font-bold">
              <td className="px-3 py-2">Grand Total</td>
              {AGE_BUCKET_KEYS.map((k) => (
                <td key={k} className="px-2 py-2 text-right tabular-nums">
                  {fmtInr(rows.reduce((s,r) => s+Number(r[k]||0), 0))}
                </td>
              ))}
              <td className="px-3 py-2 text-right">{fmtInr(grandTotal)}</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Closing Inventory panel ──────────────────────────── */
function ClosingInventoryPanel({ filters }) {
  const params = {};
  if (filters.years?.length)  params.years  = JSON.stringify(filters.years);
  if (filters.months?.length) params.months = JSON.stringify(filters.months);

  const { data, isLoading, error } = useQuery({
    queryKey: ['rpt-closing', params],
    queryFn: () => axios.get(`${API}/api/db/closing-inventory`, { params }).then((r) => r.data),
    staleTime: 30000,
  });

  if (isLoading) return <Loader />;
  if (error)     return <Err msg={error.message} />;
  const { periods = [], byType = [] } = data || {};

  const lineOpt = {
    tooltip: { trigger: 'axis', formatter: (p) => `${p[0].name}: ${fmtInr(p[0].value)}` },
    grid: { left: '3%', right: '4%', bottom: '8%', top: 20, containLabel: true },
    xAxis: { type: 'category', data: periods.map((r) => r.period_name), axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { formatter: fmtInr, fontSize: 10 } },
    series: [{
      type: 'line', data: periods.map((r) => Number(r.total_value)),
      symbolSize: 8, lineStyle: { width: 3, color: '#4f46e5' },
      itemStyle: { color: '#4f46e5', borderColor: '#fff', borderWidth: 2 },
      areaStyle: { color: 'rgba(79,70,229,0.08)' },
    }],
  };

  const typeBarOpt = {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '8%', top: 20, containLabel: true },
    xAxis: { type: 'category', data: byType.map((r) => r.item_type || 'Unknown'), axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { formatter: fmtInr, fontSize: 10 } },
    series: [{
      type: 'bar', barMaxWidth: 40,
      data: byType.map((r, i) => ({ value: Number(r.total_value), itemStyle: { color: COLORS[i % COLORS.length], borderRadius: [4,4,0,0] } })),
    }],
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPI label="Periods"       value={periods.length} />
        <KPI label="Latest Value"  value={fmtInr(periods.at(-1)?.total_value)} color="text-blue-600" />
        <KPI label="Latest Stock"  value={fmtNum(periods.at(-1)?.total_stock)} />
        <KPI label="Materials"     value={fmtNum(periods.at(-1)?.material_count)} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartContainer title="Inventory Value Trend" index={0}>
          <ReactEChartsCore echarts={echarts} option={lineOpt} style={{ height: 280 }} opts={{ renderer: 'canvas' }} notMerge />
        </ChartContainer>
        <ChartContainer title="Value by Inventory Type" index={1}>
          <ReactEChartsCore echarts={echarts} option={typeBarOpt} style={{ height: 280 }} opts={{ renderer: 'canvas' }} notMerge />
        </ChartContainer>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left">Period</th>
              <th className="px-3 py-2 text-right">Total Value</th>
              <th className="px-3 py-2 text-right">Total Stock</th>
              <th className="px-3 py-2 text-right">Materials</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((r) => (
              <tr key={r.period_name} className="border-t border-border/40 hover:bg-muted/20">
                <td className="px-3 py-1.5 font-medium">{r.period_name}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtInr(r.total_value)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r.total_stock)}</td>
                <td className="px-3 py-1.5 text-right">{r.material_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── GIT panel ────────────────────────────────────────── */
function GitPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['rpt-git'],
    queryFn: () => axios.get(`${API}/api/db/git`).then((r) => r.data),
    staleTime: 60000,
  });

  if (isLoading) return <Loader />;
  if (error)     return <Err msg={error.message} />;
  const { kpis, byBucket = [], byProduct = [], byVendor = [] } = data || {};

  const barOpt = {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '8%', top: 20, containLabel: true },
    xAxis: { type: 'category', data: byBucket.map((r) => r.bucket), axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { formatter: fmtInr, fontSize: 10 } },
    series: [{ type: 'bar', barMaxWidth: 40, data: byBucket.map((r, i) => ({ value: Number(r.total_value), itemStyle: { color: COLORS[i % COLORS.length], borderRadius: [4,4,0,0] } })) }],
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPI label="Total GIT Value" value={fmtInr(kpis?.total_value)} color="text-orange-600" />
        <KPI label="GIT Items"       value={fmtNum(kpis?.item_count)} />
        <KPI label="Vendors"         value={fmtNum(kpis?.vendor_count)} />
        <KPI label="Critical (>90d)" value={fmtNum(kpis?.critical_count)} color="text-rose-600" />
      </div>
      <ChartContainer title="GIT Ageing Buckets" index={0}>
        <ReactEChartsCore echarts={echarts} option={barOpt} style={{ height: 280 }} opts={{ renderer: 'canvas' }} notMerge />
      </ChartContainer>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-right">Value</th>
                <th className="px-3 py-2 text-right">Items</th>
              </tr>
            </thead>
            <tbody>
              {byProduct.map((r) => (
                <tr key={r.product} className="border-t border-border/40 hover:bg-muted/20">
                  <td className="px-3 py-1.5 font-medium">{r.product || '—'}</td>
                  <td className="px-3 py-1.5 text-right">{fmtInr(r.total_value)}</td>
                  <td className="px-3 py-1.5 text-right">{r.cnt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">Vendor</th>
                <th className="px-3 py-2 text-right">Value</th>
                <th className="px-3 py-2 text-right">Items</th>
              </tr>
            </thead>
            <tbody>
              {byVendor.map((r) => (
                <tr key={r.vendor_code} className="border-t border-border/40 hover:bg-muted/20">
                  <td className="px-3 py-1.5 font-medium">{r.vendor_code || '—'}</td>
                  <td className="px-3 py-1.5 text-right">{fmtInr(r.total_value)}</td>
                  <td className="px-3 py-1.5 text-right">{r.cnt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Raw Inventory panel ──────────────────────────────── */
function InventoryPanel({ filters }) {
  const [page, setPage] = useState(1);
  const params = { ...filtersToParams(filters), page, pageSize: 50 };

  const { data, isLoading, error } = useQuery({
    queryKey: ['rpt-inventory', params],
    queryFn: () => axios.get(`${API}/api/db/inventory`, { params }).then((r) => r.data),
    staleTime: 30000,
  });

  if (isLoading) return <Loader />;
  if (error)     return <Err msg={error.message} />;
  const { data: rows = [], total = 0, totalValue = 0, pages = 1 } = data || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KPI label="Total Records" value={fmtNum(total)} />
        <KPI label="Total Value"   value={fmtInr(totalValue)} color="text-indigo-600" />
        <KPI label="Showing"       value={`Page ${page} of ${pages}`} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left">Material</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">Location</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Value</th>
              <th className="px-3 py-2 text-right">Age (d)</th>
              <th className="px-3 py-2 text-left">Bucket</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border/40 hover:bg-muted/20">
                <td className="px-3 py-1.5 font-mono font-medium">{r.material}</td>
                <td className="px-3 py-1.5 max-w-[200px] truncate text-muted-foreground">{r.material_desc || '—'}</td>
                <td className="px-3 py-1.5">{r.product_type || '—'}</td>
                <td className="px-3 py-1.5">{r.storage_location || '—'}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r.quantity)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums font-medium">{fmtInr(r.total_value)}</td>
                <td className="px-3 py-1.5 text-right">{r.aging_days}</td>
                <td className="px-3 py-1.5">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{r.age_bucket}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={pages} onChange={setPage} />
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────── */
function Loader() {
  return (
    <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
      <RefreshCw className="size-4 animate-spin" /> Loading report…
    </div>
  );
}
function Err({ msg }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 text-rose-500">
      <AlertCircle className="size-6" />
      <p className="text-sm">{msg}</p>
      <p className="text-xs text-muted-foreground">MySQL may not be connected. See setup guide.</p>
    </div>
  );
}

/* ── PDF Export ───────────────────────────────────────── */
async function exportPdf(reportType, filters, reportData) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  const filterSummary = [
    filters.years?.length      ? `Years: ${filters.years.join(', ')}` : null,
    filters.months?.length     ? `Months: ${filters.months.join(', ')}` : null,
    filters.products?.length   ? `Products: ${filters.products.join(', ')}` : null,
    filters.locations?.length  ? `Locations: ${filters.locations.join(', ')}` : null,
    filters.materials?.length  ? `Materials: ${filters.materials.length} selected` : null,
    filters.ageBuckets?.length ? `Age Buckets: ${filters.ageBuckets.join(', ')}` : null,
  ].filter(Boolean).join(' | ') || 'All data — no filters applied';

  // ── Cover page ──
  doc.setFillColor(31, 78, 121);
  doc.rect(0, 0, W, 60, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22); doc.setFont('helvetica', 'bold');
  doc.text('SONA COMSTAR', W / 2, 22, { align: 'center' });
  doc.setFontSize(14); doc.setFont('helvetica', 'normal');
  doc.text('Inventory Analytics Report', W / 2, 32, { align: 'center' });
  doc.setFontSize(11);
  doc.text(REPORT_TYPES.find((t) => t.id === reportType)?.label || reportType, W / 2, 42, { align: 'center' });

  doc.setTextColor(51, 51, 51);
  doc.setFontSize(9);
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  doc.text(`Generated: ${now}`, 14, 72);
  doc.text(`Prepared by: Admin`, 14, 79);
  doc.text(`Filters: ${filterSummary}`, 14, 86, { maxWidth: W - 28 });

  // ── KPI summary table ──
  doc.addPage();
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', 14, 18);

  const kpiRows = buildKpiRows(reportType, reportData);
  if (kpiRows.length) {
    autoTable(doc, {
      startY: 24,
      head: [['Metric', 'Value']],
      body: kpiRows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [31, 78, 121], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [242, 247, 251] },
      margin: { left: 14, right: 14 },
    });
  }

  // ── Data table ──
  const tableData = buildTableData(reportType, reportData);
  if (tableData) {
    if (kpiRows.length) doc.addPage();
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text(tableData.title, 14, 18);
    autoTable(doc, {
      startY: 24,
      head: [tableData.head],
      body: tableData.body,
      styles: { fontSize: 7.5, cellPadding: 2, overflow: 'ellipsize' },
      headStyles: { fillColor: [31, 78, 121], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [242, 247, 251] },
      margin: { left: 14, right: 14 },
      didDrawPage: (d) => {
        const pg = doc.internal.getCurrentPageInfo().pageNumber;
        const total = doc.internal.getNumberOfPages();
        doc.setFontSize(8); doc.setTextColor(150);
        doc.text(`SONA COMSTAR — Confidential`, 14, doc.internal.pageSize.getHeight() - 8);
        doc.text(`Page ${pg} of ${total}`, W - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
      },
    });
  }

  const label = REPORT_TYPES.find((t) => t.id === reportType)?.label || reportType;
  doc.save(`Sona_${label.replace(/\s+/g,'_')}_${Date.now()}.pdf`);
}

function buildKpiRows(type, data) {
  if (!data) return [];
  if (type === 'storage-ageing' && data.kpis) {
    const k = data.kpis;
    return [
      ['Total Value', fmtInr(k.total_value)],
      ['Total Items', fmtNum(k.total_items)],
      ['Average Age', `${k.avg_age || 0} days`],
      ['Dead Stock (>180d)', fmtInr(k.dead_stock_value)],
      ['Slow Moving (91-180d)', fmtInr(k.slow_moving_value)],
      ['Storage Locations', k.location_count],
      ['Product Types', k.product_count],
      ['Materials', k.material_count],
    ];
  }
  if (type === 'product-ageing' && data.grandTotal) {
    return [['Grand Total', fmtInr(data.grandTotal)], ['Product Types', data.data?.length || 0]];
  }
  if (type === 'closing-inventory' && data.periods) {
    const latest = data.periods.at(-1);
    return latest ? [
      ['Latest Period', latest.period_name],
      ['Total Value', fmtInr(latest.total_value)],
      ['Total Stock', fmtNum(latest.total_stock)],
      ['Materials', latest.material_count],
    ] : [];
  }
  if (type === 'git' && data.kpis) {
    const k = data.kpis;
    return [
      ['Total GIT Value', fmtInr(k.total_value)],
      ['Items', fmtNum(k.item_count)],
      ['Vendors', k.vendor_count],
      ['Critical (>90d)', k.critical_count],
    ];
  }
  return [];
}

function buildTableData(type, data) {
  if (!data) return null;
  if (type === 'storage-ageing' && data.matrix) {
    return {
      title: 'Storage Ageing Matrix',
      head: ['Location', 'Product', ...AGE_BUCKET_LABELS, 'Total'],
      body: data.matrix.map((r) => [
        r.storage_location, r.product_type,
        ...AGE_BUCKET_KEYS.map((k) => Number(r[k]) > 0 ? fmtInr(r[k]) : ''),
        fmtInr(r.total_value),
      ]),
    };
  }
  if (type === 'product-ageing' && data.data) {
    return {
      title: 'Product Ageing Distribution',
      head: ['Product Type', ...AGE_BUCKET_LABELS, 'Total', 'Materials', 'Avg Age'],
      body: data.data.map((r) => [
        r.product_type,
        ...AGE_BUCKET_KEYS.map((k) => Number(r[k]) > 0 ? fmtInr(r[k]) : ''),
        fmtInr(r.total_value), r.material_count, `${r.avg_age}d`,
      ]),
    };
  }
  if (type === 'closing-inventory' && data.periods) {
    return {
      title: 'Closing Inventory by Period',
      head: ['Period', 'Total Value', 'Total Stock', 'Materials'],
      body: data.periods.map((r) => [r.period_name, fmtInr(r.total_value), fmtNum(r.total_stock), r.material_count]),
    };
  }
  if (type === 'git' && data.byBucket) {
    return {
      title: 'GIT Ageing Breakdown',
      head: ['Bucket', 'Items', 'Total Value'],
      body: data.byBucket.map((r) => [r.bucket, r.cnt, fmtInr(r.total_value)]),
    };
  }
  return null;
}

/* ── CSV Export ───────────────────────────────────────── */
function exportCsv(reportType, reportData) {
  const td = buildTableData(reportType, reportData);
  if (!td) { toast.error('No data to export'); return; }
  const rows = [td.head, ...td.body];
  const csv  = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `Sona_${reportType}_${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

/* ── Excel Export via backend ─────────────────────────── */
async function exportExcel(reportType, filters) {
  const params = { module: reportType === 'storage-ageing' ? 'ageing' : reportType === 'git' ? 'git' : reportType === 'closing-inventory' ? 'inventory' : 'complete', ...filtersToParams(filters) };
  const resp = await axios.get(`${API}/api/export`, { params, responseType: 'blob' });
  const url  = URL.createObjectURL(resp.data);
  const a    = document.createElement('a');
  a.href = url; a.download = `Sona_${reportType}_${Date.now()}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}

/* ── Main page ────────────────────────────────────────── */
const MONTHS_LIST = [
  { v:'1',l:'January'},{ v:'2',l:'February'},{ v:'3',l:'March'},{ v:'4',l:'April'},
  { v:'5',l:'May'},{ v:'6',l:'June'},{ v:'7',l:'July'},{ v:'8',l:'August'},
  { v:'9',l:'September'},{ v:'10',l:'October'},{ v:'11',l:'November'},{ v:'12',l:'December'},
];

function ReportMultiSelect({ label, options, selected, onChange, searchable = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const filtered = options.filter((o) => {
    const t = typeof o === 'string' ? o : o.l || o.label || String(o);
    return !search || t.toLowerCase().includes(search.toLowerCase());
  });
  const getV = (o) => typeof o === 'string' ? o : o.v || o.value || String(o);
  const getL = (o) => typeof o === 'string' ? o : o.l || o.label || String(o);
  const isSelected = (o) => selected.includes(getV(o));
  const toggle = (o) => {
    const v = getV(o);
    onChange(isSelected(o) ? selected.filter((s) => s !== v) : [...selected, v]);
  };
  const summary = selected.length === 0 ? 'All' : selected.length === 1 ? getL(options.find((o) => getV(o) === selected[0]) || selected[0]) : `${selected.length} selected`;
  return (
    <div ref={ref} className="relative flex-1 min-w-[130px]">
      <button onClick={() => setOpen((p) => !p)}
        className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${selected.length > 0 ? 'border-primary/60 bg-primary/8 text-primary font-medium' : 'border-border bg-background text-foreground hover:bg-muted/50'}`}>
        <span className="flex-1 text-left truncate text-xs">
          <span className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px] block">{label}</span>
          {summary}
        </span>
        {selected.length > 0 && <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{selected.length}</span>}
        <svg className={`size-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-border bg-background shadow-lg">
          {searchable && (
            <div className="border-b border-border p-2">
              <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
                className="h-8 w-full rounded-md border border-border bg-muted/30 px-3 text-xs outline-none focus:border-primary" />
            </div>
          )}
          <div className="flex gap-2 border-b border-border/50 px-2 py-1.5">
            <button onClick={() => onChange(options.map(getV))} className="text-xs text-primary hover:underline">All</button>
            <span className="text-muted-foreground">·</span>
            <button onClick={() => { onChange([]); setSearch(''); }} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0
              ? <p className="py-4 text-center text-xs text-muted-foreground">No options</p>
              : filtered.map((o, i) => (
                <label key={i} className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-muted/40 text-sm">
                  <input type="checkbox" checked={isSelected(o)} onChange={() => toggle(o)} className="size-3.5 rounded accent-primary" />
                  <span className="truncate text-sm">{getL(o)}</span>
                </label>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  const [reportType, setReportType] = useState('storage-ageing');
  const [filters, setFilters] = useState({ years:[], months:[], products:[], locations:[], materials:[], dates:[], days:[] });
  const [reportData, setReportData] = useState(null);
  const qc = useQueryClient();

  const { data: summary } = useDashboardSummary();
  const { data: filterOptions, isLoading: filtersLoading } = useQuery({
    queryKey: ['filter-options'],
    queryFn: () => axios.get(`${API}/api/filters`).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const mysqlAvailable = filterOptions?.mysqlAvailable !== false;

  // Build filter options from MySQL if available, else from summary data
  const yearOptions = useMemo(() => {
    if (filterOptions?.years?.length) return filterOptions.years.map(String);
    const periods = summary?.inventory?.periodSummaries ?? [];
    return [...new Set(periods.map((p) => p.period.split(' ')[1]).filter(Boolean))].sort();
  }, [filterOptions, summary]);

  const productOptions = useMemo(() => {
    if (filterOptions?.products?.length) return filterOptions.products;
    return (summary?.productAnalytics ?? []).map((p) => p.productType).filter(Boolean);
  }, [filterOptions, summary]);

  const locationOptions = useMemo(() => {
    if (filterOptions?.locations?.length) return filterOptions.locations;
    const mat = summary?.ageing?.storageAgeingMatrix ?? [];
    return [...new Set(mat.map((r) => r.storageLocation))].sort();
  }, [filterOptions, summary]);

  const set = (key, val) => setFilters((f) => ({ ...f, [key]: val }));
  const activeCount = Object.values(filters).flat().length;
  const resetFilters = () => setFilters({ years:[], months:[], products:[], locations:[], materials:[], dates:[], days:[] });

  const handlePdf = useCallback(async () => {
    if (!reportData) { toast.error('No data loaded'); return; }
    toast.info('Generating PDF…');
    try { await exportPdf(reportType, filters, reportData); toast.success('PDF downloaded'); }
    catch (e) { toast.error('PDF failed: ' + e.message); }
  }, [reportType, filters, reportData]);

  const handleCsv = useCallback(() => {
    if (!reportData) { toast.error('No data loaded'); return; }
    exportCsv(reportType, reportData);
    toast.success('CSV downloaded');
  }, [reportType, reportData]);

  const handleExcel = useCallback(async () => {
    try { await exportExcel(reportType, filters); toast.success('Excel downloaded'); }
    catch (e) { toast.error('Excel export failed: ' + e.message); }
  }, [reportType, filters]);

  const saveHistory = useCallback(async (format) => {
    try {
      await axios.post(`${API}/api/history`, {
        report_name: `${REPORT_TYPES.find((t) => t.id === reportType)?.label} Report`,
        report_type: reportType,
        filters_json: filters,
        export_format: format,
      });
      qc.invalidateQueries(['report-history']);
    } catch {}
  }, [reportType, filters, qc]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Reports"
        description="Enterprise-grade inventory reports powered by MySQL"
      />

      {/* MySQL Status Banner */}
      {!filtersLoading && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm ${mysqlAvailable ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400'}`}>
          {mysqlAvailable ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
          {mysqlAvailable
            ? 'MySQL connected — reports are fully dynamic and filter-driven.'
            : 'MySQL not connected. Copy .env.example → .env, configure credentials, restart backend. Reports below require MySQL.'}
        </div>
      )}

      {/* Report Type Selector */}
      <div className="flex flex-wrap gap-2">
        {REPORT_TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => { setReportType(t.id); setReportData(null); }}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                reportType === t.id
                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}
            >
              <Icon className={`size-4 ${reportType === t.id ? 'text-primary' : t.color}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
            <span className="text-sm font-semibold">Filters</span>
            {activeCount > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">{activeCount}</span>}
          </div>
          {activeCount > 0 && (
            <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Reset all
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Date — calendar picker */}
          <CalendarDateSelect selected={filters.dates || []} onChange={(v) => set('dates', v)} />
          {/* Year */}
          <ReportMultiSelect label="Year" options={yearOptions} selected={filters.years} onChange={(v) => set('years', v)} />
          {/* Month */}
          <ReportMultiSelect label="Month" options={MONTHS_LIST} selected={filters.months} onChange={(v) => set('months', v)} />
          {/* Product Type */}
          <ReportMultiSelect label="Product Type" options={productOptions} selected={filters.products} onChange={(v) => set('products', v)} searchable />
          {/* Storage Location */}
          <ReportMultiSelect label="Storage Location" options={locationOptions} selected={filters.locations} onChange={(v) => set('locations', v)} searchable />
          {/* Days */}
          <ReportMultiSelect label="Days" options={['0-30','31-60','61-90','91-180','181-365','366-730','731-1095','1096-1460','1461-1825','>1825']} selected={filters.days} onChange={(v) => set('days', v)} />
        </div>
        {/* Active filter chips */}
        {activeCount > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/40">
            {filters.dates.map((d) => (
              <span key={d} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {d}<button onClick={() => set('dates', filters.dates.filter((x) => x !== d))}><svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
              </span>
            ))}
            {filters.years.map((v) => (
              <span key={v} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {v}<button onClick={() => set('years', filters.years.filter((x) => x !== v))}><svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
              </span>
            ))}
            {filters.months.map((v) => (
              <span key={v} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {MONTHS_LIST.find((m) => m.v === v)?.l || v}<button onClick={() => set('months', filters.months.filter((x) => x !== v))}><svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
              </span>
            ))}
            {filters.products.map((v) => (
              <span key={v} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {v}<button onClick={() => set('products', filters.products.filter((x) => x !== v))}><svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
              </span>
            ))}
            {filters.locations.map((v) => (
              <span key={v} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {v}<button onClick={() => set('locations', filters.locations.filter((x) => x !== v))}><svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
              </span>
            ))}
            {filters.days.map((v) => (
              <span key={v} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {v} days<button onClick={() => set('days', filters.days.filter((x) => x !== v))}><svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Export Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 px-4 py-3">
        <p className="text-sm font-medium text-muted-foreground">
          Export filtered report as:
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => { handlePdf(); saveHistory('pdf'); }}
            className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-700 transition-colors"
          >
            <FileText className="size-4" /> PDF
          </button>
          <button
            onClick={() => { handleExcel(); saveHistory('xlsx'); }}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 transition-colors"
          >
            <FileSpreadsheet className="size-4" /> Excel
          </button>
          <button
            onClick={() => { handleCsv(); saveHistory('csv'); }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
          >
            <Table2 className="size-4" /> CSV
          </button>
        </div>
      </div>

      {/* Report Panel */}
      {mysqlAvailable && (
        <ReportPanel
          reportType={reportType}
          filters={filters}
          onDataLoaded={setReportData}
        />
      )}
    </div>
  );
}

/* ── Panel router ─────────────────────────────────────── */
function ReportPanel({ reportType, filters, onDataLoaded }) {
  const params = filtersToParams(filters);

  const queryFns = {
    'storage-ageing':    () => axios.get(`${API}/api/db/storage-ageing`,   { params }).then((r) => r.data),
    'product-ageing':    () => axios.get(`${API}/api/db/product-ageing`,    { params }).then((r) => r.data),
    'closing-inventory': () => axios.get(`${API}/api/db/closing-inventory`, { params }).then((r) => r.data),
    'git':               () => axios.get(`${API}/api/db/git`).then((r) => r.data),
    'inventory':         () => axios.get(`${API}/api/db/inventory`,         { params }).then((r) => r.data),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['active-report', reportType, params],
    queryFn: queryFns[reportType] || (() => Promise.resolve({})),
    staleTime: 30000,
  });

  if (data && onDataLoaded) {
    // call in effect-like way without useEffect to avoid loop
    setTimeout(() => onDataLoaded(data), 0);
  }

  const panelProps = { filters, data };

  if (reportType === 'storage-ageing')    return <StorageAgeingPanel {...panelProps} />;
  if (reportType === 'product-ageing')    return <ProductAgeingPanel {...panelProps} />;
  if (reportType === 'closing-inventory') return <ClosingInventoryPanel {...panelProps} />;
  if (reportType === 'git')               return <GitPanel {...panelProps} />;
  if (reportType === 'inventory')         return <InventoryPanel {...panelProps} />;
  return null;
}
