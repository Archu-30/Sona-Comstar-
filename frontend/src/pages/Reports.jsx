/**
 * Reports.jsx — Export Center
 *
 * This page is an Export Center ONLY.
 * It shows:
 *   1. Report Type Tabs
 *   2. Filters (Year, Month, Product, Location, Age Bucket, Date)
 *   3. Export Buttons (PDF, Excel, CSV)
 *
 * NO KPI cards, NO charts, NO tables, NO panels below the export bar.
 *
 * All export logic is wired to the backend /api/export (GET).
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  Download, FileText, FileSpreadsheet, Table2,
  BarChart3, Clock, Package, Truck, Layers,
  RefreshCw, Database, AlertCircle, CheckCircle2,
  Check, Search, ChevronDown, X, Filter, RotateCcw,
  ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { CalendarDateSelect } from '../components/shared/GlobalFilters';
import { useDashboardSummary } from '../hooks/useData';
import { cn } from '../lib/utils';

const API = '';

/* ────────────────────────────────────────────────────────────
   Report type tabs — Raw Inventory replaced with Complete Report
   ──────────────────────────────────────────────────────────── */
const REPORT_TYPES = [
  { id: 'complete',           label: 'Complete Report',    icon: FileSpreadsheet, color: 'text-emerald-600', desc: 'Full 10-sheet SAP-style workbook' },
  { id: 'storage-ageing',    label: 'Storage Ageing',     icon: Clock,           color: 'text-cyan-600',    desc: 'Ageing matrix by location & product' },
  { id: 'product-ageing',    label: 'Product Analytics',  icon: Layers,          color: 'text-purple-600',  desc: 'Age distribution by product type' },
  { id: 'closing-inventory', label: 'Closing Inventory',  icon: Package,         color: 'text-blue-600',    desc: 'Period-wise closing balances' },
  { id: 'git',               label: 'GIT / In-Transit',   icon: Truck,           color: 'text-orange-600',  desc: 'Goods in transit analysis' },
  { id: 'dashboard',         label: 'Dashboard',          icon: BarChart3,       color: 'text-indigo-600',  desc: 'Executive dashboard overview' },
];

/* ────────────────────────────────────────────────────────────
   Age bucket options — MUST match backend bucketToSql()
   ──────────────────────────────────────────────────────────── */
const AGE_BUCKET_OPTIONS = [
  { value: '0-30 Days',    label: '0–30 Days' },
  { value: '31-60 Days',   label: '31–60 Days' },
  { value: '61-90 Days',   label: '61–90 Days' },
  { value: '91-180 Days',  label: '91–180 Days' },
  { value: '181-365 Days', label: '181–365 Days' },
  { value: 'Above 1 Year', label: 'Above 1 Year' },
  { value: 'Above 2 Years',label: 'Above 2 Years' },
  { value: 'Above 3 Years',label: 'Above 3 Years' },
  { value: 'Above 4 Years',label: 'Above 4 Years' },
  { value: 'Above 5 Years',label: 'Above 5 Years' },
];

const MONTHS_LIST = [
  { v:'1',l:'January'},{ v:'2',l:'February'},{ v:'3',l:'March'},{ v:'4',l:'April'},
  { v:'5',l:'May'},{ v:'6',l:'June'},{ v:'7',l:'July'},{ v:'8',l:'August'},
  { v:'9',l:'September'},{ v:'10',l:'October'},{ v:'11',l:'November'},{ v:'12',l:'December'},
];

/* ────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────── */
function fmtInr(v) {
  if (!v && v !== 0) return '—';
  const n = Number(v);
  if (n >= 10000000) return `₹${(n/10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n/100000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function filtersToParams(f) {
  const p = {};
  if (f.years?.length)     p.years     = JSON.stringify(f.years);
  if (f.months?.length)    p.months    = JSON.stringify(f.months);
  if (f.products?.length)  p.products  = JSON.stringify(f.products);
  if (f.locations?.length) p.locations = JSON.stringify(f.locations);
  if (f.materials?.length) p.materials = JSON.stringify(f.materials);
  if (f.dates?.length)     p.dates     = JSON.stringify(f.dates);
  if (f.days?.length)      p.days      = JSON.stringify(f.days);
  if (f.dayDates?.length)  p.dayDates  = JSON.stringify(f.dayDates);
  return p;
}

/* ────────────────────────────────────────────────────────────
   Portal-based multi-select filter component
   ──────────────────────────────────────────────────────────── */
function FilterMultiSelect({ label, options, selected, onChange, searchable = false }) {
  const [open, setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos]     = useState({ top: 0, left: 0, width: 220 });
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);

  const opts = options.map((o) =>
    typeof o === 'string'
      ? { value: o, label: o }
      : { value: o.v ?? o.value ?? String(o), label: o.l ?? o.label ?? String(o) }
  );

  const filtered = search ? opts.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())) : opts;
  const isSelected = (v) => selected.map(String).includes(String(v));

  const toggle = (v) => {
    const vStr = String(v);
    const selectedStrs = selected.map(String);
    if (selectedStrs.includes(vStr)) {
      onChange(selected.filter((s) => String(s) !== vStr));
    } else {
      const opt = opts.find((o) => String(o.value) === vStr);
      onChange([...selected, opt ? opt.value : v]);
    }
  };

  const selectAll = () => onChange(opts.map((o) => o.value));
  const clearAll  = () => { onChange([]); setSearch(''); };

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: Math.max(r.width, 220) });
  }, []);

  const handleOpen = () => { updatePos(); setOpen((p) => !p); };

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target) && dropRef.current && !dropRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    window.addEventListener('scroll', updatePos, true);
    return () => { document.removeEventListener('mousedown', h); window.removeEventListener('scroll', updatePos, true); };
  }, [open, updatePos]);

  const summary = selected.length === 0 ? 'All'
    : selected.length === 1 ? (opts.find((o) => String(o.value) === String(selected[0]))?.label ?? selected[0])
    : `${selected.length} selected`;

  const dropdown = open ? createPortal(
    <div
      ref={dropRef}
      style={{ position: 'absolute', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="rounded-xl border border-border bg-background shadow-2xl overflow-hidden"
    >
      {searchable && (
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
              className="h-8 w-full rounded-md border border-border bg-muted/30 pl-7 pr-3 text-xs outline-none focus:border-primary" />
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 border-b border-border/50 px-3 py-1.5">
        <button onClick={selectAll} className="text-xs text-primary hover:underline font-medium">Select All</button>
        <span className="text-border text-xs">|</span>
        <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
        {selected.length > 0 && <span className="ml-auto text-xs text-muted-foreground">{selected.length} of {opts.length}</span>}
      </div>
      <div className="max-h-56 overflow-y-auto overscroll-contain">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No options</p>
        ) : filtered.map((o) => (
          <label key={o.value} className={cn('flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-muted/50 transition-colors text-sm', isSelected(o.value) && 'bg-primary/5')}>
            <span className={cn('flex size-4 shrink-0 items-center justify-center rounded border transition-colors', isSelected(o.value) ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
              {isSelected(o.value) && <Check className="size-3" />}
            </span>
            <span className="truncate flex-1">{o.label}</span>
          </label>
        ))}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative flex-1 min-w-[130px]">
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className={cn(
          'w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all',
          selected.length > 0 ? 'border-primary/60 bg-primary/8 text-primary font-medium' : 'border-border bg-background text-foreground hover:bg-muted/50'
        )}
      >
        <span className="flex-1 text-left truncate text-xs">
          <span className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px] block">{label}</span>
          {summary}
        </span>
        {selected.length > 0 && (
          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {selected.length}
          </span>
        )}
        <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {dropdown}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   CSV export — via GET /api/export
   ──────────────────────────────────────────────────────────── */
async function exportCsv(reportType, filters) {
  const params = {
    module: reportType,
    format: 'csv',
    ...filtersToParams(filters),
  };

  const resp = await axios.get(`${API}/api/export`, {
    params,
    responseType: 'blob',
    timeout: 120000,
  });

  const cd = resp.headers['content-disposition'] || '';
  const match = cd.match(/filename="?([^";\n]+)"?/);
  const filename = match ? match[1] : `SonaComstar_${reportType}_${Date.now()}.csv`;

  const url = URL.createObjectURL(new Blob([resp.data], {
    type: 'text/csv',
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ────────────────────────────────────────────────────────────
   Excel export — via GET /api/export
   ──────────────────────────────────────────────────────────── */
async function exportExcel(reportType, filters) {
  const params = {
    module: reportType,
    format: 'xlsx',
    ...filtersToParams(filters),
  };

  const resp = await axios.get(`${API}/api/export`, {
    params,
    responseType: 'blob',
    timeout: 120000, // 2 min for large workbooks
  });

  // Extract filename from Content-Disposition header
  const cd = resp.headers['content-disposition'] || '';
  const match = cd.match(/filename="?([^";\n]+)"?/);
  const filename = match ? match[1] : `SonaComstar_${reportType}_${Date.now()}.xlsx`;

  const url = URL.createObjectURL(new Blob([resp.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ────────────────────────────────────────────────────────────
   Applied filter summary (for display)
   ──────────────────────────────────────────────────────────── */
function FilterSummary({ filters, onRemove }) {
  const chips = [];
  const add = (key, items, getLabel) =>
    items.forEach((v) => chips.push({ key, value: v, label: getLabel(v) }));

  add('dates',     filters.dates    || [], (v) => `📅 ${v}`);
  add('years',     filters.years    || [], (v) => `Year: ${v}`);
  add('months',    filters.months   || [], (v) => `Month: ${MONTHS_LIST.find((m) => m.v === v)?.l || v}`);
  add('dayDates',  filters.dayDates || [], (v) => `Date: ${v}`);
  add('products',  filters.products || [], (v) => `Product: ${v}`);
  add('locations', filters.locations|| [], (v) => `Location: ${v}`);
  add('days',      filters.days     || [], (v) => `Age: ${v}`);

  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/30">
      {chips.map((c, i) => (
        <span key={i} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          {c.label}
          <button onClick={() => onRemove(c.key, c.value)} className="hover:text-primary/60 transition-colors">
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Main Reports Page — Export Center
   ──────────────────────────────────────────────────────────── */
export default function Reports() {
  const [reportType, setReportType] = useState('complete');
  const [filters, setFilters] = useState({
    years: [], months: [], products: [], locations: [],
    materials: [], dates: [], days: [], dayDates: [],
  });
  const [exporting, setExporting] = useState(null); // 'excel' | 'pdf' | null
  const qc = useQueryClient();

  const { data: summary } = useDashboardSummary();
  const { data: filterOptions, isLoading: filtersLoading } = useQuery({
    queryKey: ['filter-options'],
    queryFn: () => axios.get(`${API}/api/filters`).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const mysqlAvailable = filterOptions?.mysqlAvailable !== false;

  const maxDays = useMemo(() => {
    const years = filters.years.length > 0 ? filters.years.map(Number) : [new Date().getFullYear()];
    const months = filters.months.length > 0 ? filters.months.map(m => Number(m) - 1) : Array.from({length: 12}, (_, i) => i);
    
    let max = 31;
    if (filters.months.length > 0) {
      max = 0;
      for (const y of years) {
        for (const m of months) {
          if (m >= 0 && m < 12) {
            const days = new Date(y, m + 1, 0).getDate();
            if (days > max) max = days;
          }
        }
      }
    }
    return max;
  }, [filters.years, filters.months]);

  const dateOptions = useMemo(() => {
    return Array.from({ length: maxDays }, (_, i) => String(i + 1));
  }, [maxDays]);

  const set = (key, val) => setFilters((f) => ({ ...f, [key]: val }));

  useEffect(() => {
    if (filters.dayDates?.length > 0) {
      const validDates = filters.dayDates.filter(d => Number(d) <= maxDays);
      if (validDates.length !== filters.dayDates.length) {
        set('dayDates', validDates);
      }
    }
  }, [maxDays, filters.dayDates]);

  // Build filter option lists
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

  const activeCount = Object.values(filters).flat().length;

  const removeFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: (f[key] || []).filter((v) => v !== value) }));
  };

  const resetFilters = () => setFilters({ years:[], months:[], products:[], locations:[], materials:[], dates:[], days:[], dayDates:[] });

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

  const handleExcel = useCallback(async () => {
    setExporting('excel');
    try {
      await exportExcel(reportType, filters);
      toast.success('✅ Excel downloaded successfully');
      saveHistory('xlsx');
    } catch (e) {
      console.error('Excel export error:', e);
      toast.error('Excel export failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setExporting(null);
    }
  }, [reportType, filters, saveHistory]);

  const handleCsv = useCallback(async () => {
    setExporting('csv');
    try {
      await exportCsv(reportType, filters);
      toast.success('✅ CSV downloaded successfully');
      saveHistory('csv');
    } catch (e) {
      console.error('CSV export error:', e);
      toast.error('CSV export failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setExporting(null);
    }
  }, [reportType, filters, saveHistory]);

  const isExporting = exporting !== null;
  const selectedReport = REPORT_TYPES.find((t) => t.id === reportType);

  return (
    <div className="space-y-5 p-6">
      {/* Page Header */}
      <PageHeader
        title="Reports"
        description="Select a report type, apply filters, and export as Excel or CSV"
      />

      {/* MySQL Status Banner */}
      {!filtersLoading && (
        <div className={cn(
          'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm border',
          mysqlAvailable
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400'
            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400'
        )}>
          {mysqlAvailable ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
          {mysqlAvailable
            ? 'MySQL connected — exports use live filtered data.'
            : 'MySQL not connected. Configure .env → restart backend. Excel exports will include a notice sheet.'}
        </div>
      )}

      {/* Report Type Selector */}
      <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Report Type</p>
        <div className="flex flex-wrap gap-2">
          {REPORT_TYPES.map((t) => {
            const Icon = t.icon;
            const isActive = reportType === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setReportType(t.id)}
                title={t.desc}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'border-primary bg-primary/10 text-primary shadow-sm scale-[1.02]'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-muted/30'
                )}
              >
                <Icon className={cn('size-4', isActive ? 'text-primary' : t.color)} />
                {t.label}
                {t.id === 'complete' && (
                  <span className="rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 dark:bg-emerald-950/60 dark:text-emerald-400">
                    SAP
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {selectedReport && (
          <p className="mt-2 text-xs text-muted-foreground">{selectedReport.desc}</p>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Filters</span>
            {activeCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                {activeCount}
              </span>
            )}
          </div>
          {activeCount > 0 && (
            <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <RotateCcw className="size-3" /> Reset all
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Calendar date picker */}
          <CalendarDateSelect
            selected={filters.dates || []}
            onChange={(v) => set('dates', v)}
          />

          {/* Year */}
          <FilterMultiSelect
            label="Year"
            options={yearOptions}
            selected={filters.years}
            onChange={(v) => set('years', v)}
          />

          {/* Month */}
          <FilterMultiSelect
            label="Month"
            options={MONTHS_LIST}
            selected={filters.months}
            onChange={(v) => set('months', v)}
          />

          {/* Date */}
          <FilterMultiSelect
            label="Date"
            options={dateOptions}
            selected={filters.dayDates || []}
            onChange={(v) => set('dayDates', v)}
          />

          {/* Product Type */}
          <FilterMultiSelect
            label="Product Type"
            options={productOptions}
            selected={filters.products}
            onChange={(v) => set('products', v)}
            searchable
          />

          {/* Storage Location */}
          <FilterMultiSelect
            label="Storage Location"
            options={locationOptions}
            selected={filters.locations}
            onChange={(v) => set('locations', v)}
            searchable
          />

          {/* Age Bucket (Days) — correct labels matching backend */}
          <FilterMultiSelect
            label="Age Bucket"
            options={AGE_BUCKET_OPTIONS}
            selected={filters.days}
            onChange={(v) => set('days', v)}
          />
        </div>

        {/* Active filter chips */}
        <FilterSummary filters={filters} onRemove={removeFilter} />
      </div>

      {/* Export Bar */}
      <div className="rounded-xl border border-border/60 bg-gradient-to-r from-card to-card/80 backdrop-blur px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Export: <span className="text-primary">{selectedReport?.label}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeCount > 0
                ? `${activeCount} filter${activeCount > 1 ? 's' : ''} applied — exported data will be filtered`
                : 'No filters applied — full dataset will be exported'}
            </p>
          </div>

          <div className="flex gap-2.5 flex-wrap">
            {/* CSV */}
            {reportType !== 'complete' && (
              <button
                onClick={handleCsv}
                disabled={isExporting}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow transition-all',
                  isExporting && exporting !== 'csv'
                    ? 'bg-blue-400 cursor-not-allowed opacity-60'
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-95',
                )}
              >
                {exporting === 'csv' ? (
                  <><Loader2 className="size-4 animate-spin" /> Generating CSV…</>
                ) : (
                  <><FileText className="size-4" /> CSV</>
                )}
              </button>
            )}

            {/* Excel */}
            <button
              onClick={handleExcel}
              disabled={isExporting}
              className={cn(
                'flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow transition-all',
                isExporting && exporting !== 'excel'
                  ? 'bg-emerald-400 cursor-not-allowed opacity-60'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95',
              )}
            >
              {exporting === 'excel' ? (
                <><Loader2 className="size-4 animate-spin" /> Generating Excel…</>
              ) : (
                <><FileSpreadsheet className="size-4" /> Excel</>
              )}
            </button>
          </div>
        </div>

        {/* Export notes */}
        <div className="mt-3 pt-3 border-t border-border/30 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-start gap-1.5">
            <FileSpreadsheet className="size-3.5 mt-0.5 text-emerald-600 shrink-0" />
            <span>
              <strong>Excel:</strong>{' '}
              {reportType === 'complete'
                ? '10-sheet professional workbook (Executive Summary → Validation)'
                : 'Single-sheet report with KPIs, tables, and applied filters'}
            </span>
          </div>
          {reportType !== 'complete' && (
            <div className="flex items-start gap-1.5">
              <FileText className="size-3.5 mt-0.5 text-blue-600 shrink-0" />
              <span>
                <strong>CSV:</strong> Standard comma-separated values text file of the filtered report data
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Export filename preview */}
      <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <p className="font-semibold mb-1">📁 Export filename will be:</p>
        <div className="space-y-0.5 font-mono text-[11px]">
          {(() => {
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const date = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
            const time = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
            const prefix = reportType === 'complete' ? 'Complete_Report' : (selectedReport?.label || reportType).replace(/\s+/g, '_');
            return (
              <>
                {reportType !== 'complete' && <p>SonaComstar_{prefix}_{date}_{time}.csv</p>}
                <p>SonaComstar_{prefix}_{date}_{time}.xlsx</p>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
