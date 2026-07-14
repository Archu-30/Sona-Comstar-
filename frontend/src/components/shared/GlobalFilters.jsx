import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Filter, X, ChevronDown, Search, RotateCcw, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * CORRECTED Days / Age-Bucket labels.
 * These MUST match bucketToSql() in backend/routes/reportsDb.js
 */
const DAYS_OPTIONS = [
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

/* ─── Generic multi-select dropdown (portal-based) ──────────────────────────── */
function MultiSelect({ label, options, selected, onChange, searchable = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0, width: 220 });
  const triggerRef = useRef(null);
  const dropRef = useRef(null);

  // Normalise options
  const opts = options.map((o) =>
    typeof o === 'string'
      ? { value: o, label: o }
      : { value: o.value ?? o.v ?? String(o), label: o.label ?? o.l ?? String(o) }
  );

  const filtered = search
    ? opts.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : opts;

  const getValue = (o) => o.value;
  const getLabel = (o) => o.label;
  const isSelected = (v) => selected.includes(v);

  const toggle = (v) => {
    onChange(isSelected(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  };

  const selectAll = () => onChange(opts.map((o) => o.value));
  const clearAll  = () => { onChange([]); setSearch(''); };

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({
      top:   r.bottom + window.scrollY + 4,
      left:  r.left   + window.scrollX,
      width: Math.max(r.width, 220),
    });
  }, []);

  const handleOpen = () => { updatePos(); setOpen((p) => !p); };

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropRef.current    && !dropRef.current.contains(e.target)
      ) setOpen(false);
    };
    const onScroll = () => updatePos();
    document.addEventListener('mousedown', h);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', h);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, updatePos]);

  const summary = selected.length === 0 ? 'All'
    : selected.length === 1 ? (opts.find((o) => o.value === selected[0])?.label ?? selected[0])
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
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-8 w-full rounded-md border border-border bg-muted/30 pl-7 pr-3 text-xs outline-none focus:border-primary"
            />
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 border-b border-border/50 px-3 py-1.5">
        <button onClick={selectAll} className="text-xs text-primary hover:underline font-medium">Select All</button>
        <span className="text-border text-xs">|</span>
        <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
        {selected.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">{selected.length} of {opts.length}</span>
        )}
      </div>
      <div className="max-h-56 overflow-y-auto overscroll-contain">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No options</p>
        ) : filtered.map((o) => (
          <label
            key={o.value}
            className={cn(
              'flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-muted/50 transition-colors text-sm',
              isSelected(o.value) && 'bg-primary/5'
            )}
          >
            <span className={cn(
              'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
              isSelected(o.value) ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
            )}>
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
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors min-w-[140px]',
          selected.length > 0
            ? 'border-primary/60 bg-primary/5 text-primary font-medium'
            : 'border-border bg-background text-foreground hover:bg-muted/50'
        )}
      >
        <span className="flex-1 text-left truncate">{label}: <span className="opacity-70">{summary}</span></span>
        {selected.length > 0 && (
          <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {selected.length}
          </span>
        )}
        <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {dropdown}
    </div>
  );
}

/* ─── Material searchable select ─────────────────────────────────────────────── */
function MaterialSelect({ materials, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0, width: 280 });
  const triggerRef = useRef(null);
  const dropRef = useRef(null);

  const filtered = materials.filter(
    (m) =>
      !search ||
      m.material.toLowerCase().includes(search.toLowerCase()) ||
      (m.desc || '').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 100);

  const toggle = (mat) => {
    onChange(selected.includes(mat) ? selected.filter((s) => s !== mat) : [...selected, mat]);
  };

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: Math.max(r.width, 280) });
  }, []);

  const handleOpen = () => { updatePos(); setOpen((p) => !p); };

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropRef.current    && !dropRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const summary = selected.length === 0 ? 'All' : `${selected.length} selected`;

  const dropdown = open ? createPortal(
    <div
      ref={dropRef}
      style={{ position: 'absolute', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="rounded-xl border border-border bg-background shadow-2xl overflow-hidden"
    >
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search material code or description…"
            className="h-8 w-full rounded-md border border-border bg-muted/30 pl-7 pr-3 text-xs outline-none focus:border-primary"
          />
        </div>
      </div>
      {selected.length > 0 && (
        <div className="flex items-center justify-between border-b border-border/50 px-3 py-1">
          <span className="text-xs text-muted-foreground">{selected.length} selected</span>
          <button onClick={() => onChange([])} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}
      <div className="max-h-64 overflow-y-auto">
        {filtered.map((m) => (
          <label key={m.material} className="flex cursor-pointer items-start gap-2.5 px-3 py-1.5 hover:bg-muted/40">
            <input
              type="checkbox"
              checked={selected.includes(m.material)}
              onChange={() => toggle(m.material)}
              className="mt-0.5 size-3.5 rounded accent-primary"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium">{m.material}</p>
              {m.desc && <p className="truncate text-[11px] text-muted-foreground">{m.desc}</p>}
            </div>
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">No materials found</p>
        )}
        {materials.filter((m) =>
          !search || m.material.toLowerCase().includes(search.toLowerCase()) || (m.desc || '').toLowerCase().includes(search.toLowerCase())
        ).length > 100 && (
          <p className="py-2 text-center text-xs text-muted-foreground">Showing first 100 — refine search</p>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors min-w-[160px]',
          selected.length > 0
            ? 'border-primary/60 bg-primary/5 text-primary font-medium'
            : 'border-border bg-background text-foreground hover:bg-muted/50'
        )}
      >
        <span className="flex-1 text-left truncate">Material: <span className="opacity-70">{summary}</span></span>
        {selected.length > 0 && (
          <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {selected.length}
          </span>
        )}
        <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {dropdown}
    </div>
  );
}

/* ─── Calendar multi-date select ─────────────────────────────────────────────── */
const MONTH_NAMES_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_HEADERS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export function CalendarDateSelect({ selected = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => new Date());
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const dropRef = useRef(null);

  const updatePos = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX });
  }, []);

  const handleOpen = () => { updatePos(); setOpen((p) => !p); };

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (
        btnRef.current  && !btnRef.current.contains(e.target) &&
        dropRef.current && !dropRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    window.addEventListener('scroll', () => { updatePos(); }, true);
    return () => {
      document.removeEventListener('mousedown', h);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open, updatePos]);

  const year  = view.getFullYear();
  const month = view.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = (d) => `${year}-${pad(month + 1)}-${pad(d)}`;
  const isDateSelected = (d) => selected.includes(dateStr(d));

  const toggle = (d) => {
    const s = dateStr(d);
    onChange(selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s]);
  };

  const prevMonth = () => setView(new Date(year, month - 1, 1));
  const nextMonth = () => setView(new Date(year, month + 1, 1));

  const summary = selected.length === 0 ? 'All'
    : selected.length === 1 ? selected[0]
    : `${selected.length} dates`;

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dropdown = open ? createPortal(
    <div
      ref={dropRef}
      style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999 }}
      className="w-72 rounded-xl border border-border bg-background shadow-2xl p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="rounded-lg p-1 hover:bg-muted/60 transition-colors">
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-semibold">{MONTH_NAMES_FULL[month]} {year}</span>
        <button onClick={nextMonth} className="rounded-lg p-1 hover:bg-muted/60 transition-colors">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((d) => (
          <span key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-1">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) =>
          day === null ? (
            <div key={`e-${i}`} />
          ) : (
            <button
              key={day}
              onClick={() => toggle(day)}
              className={cn(
                'h-8 w-full rounded-md text-sm transition-colors',
                isDateSelected(day) ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted/60 text-foreground'
              )}
            >
              {day}
            </button>
          )
        )}
      </div>
      {selected.length > 0 && (
        <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2">
          <span className="text-xs text-muted-foreground">{selected.length} date(s) selected</span>
          <button onClick={() => onChange([])} className="text-xs text-muted-foreground hover:text-foreground">Clear all</button>
        </div>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors min-w-[140px]',
          selected.length > 0
            ? 'border-primary/60 bg-primary/5 text-primary font-medium'
            : 'border-border bg-background text-foreground hover:bg-muted/50'
        )}
      >
        <span className="flex-1 text-left truncate">Date: <span className="opacity-70">{summary}</span></span>
        {selected.length > 0 && (
          <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {selected.length}
          </span>
        )}
        <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {dropdown}
    </div>
  );
}

/* ─── Active filter chips ─────────────────────────────────────────────────────── */
function FilterChips({ filters, onChange }) {
  const chips = [];
  const add = (key, items, setter) =>
    items.forEach((v) =>
      chips.push({ key, label: v, remove: () => setter(items.filter((i) => i !== v)) })
    );
  add('years',     filters.years,     (v) => onChange('years', v));
  add('months',    filters.months,    (v) => onChange('months', v));
  add('products',  filters.products,  (v) => onChange('products', v));
  add('locations', filters.locations, (v) => onChange('locations', v));
  add('materials', filters.materials, (v) => onChange('materials', v));
  add('dates',     filters.dates,     (v) => onChange('dates', v));
  add('days',      filters.days,      (v) => onChange('days', v));
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {chips.map((c, i) => (
        <span key={i} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          {c.label}
          <button onClick={c.remove} className="hover:text-primary/60"><X className="size-3" /></button>
        </span>
      ))}
    </div>
  );
}

/* ─── Main GlobalFilters component ───────────────────────────────────────────── */
export function GlobalFilters({ filters, onChange, options = {}, compact = false }) {
  const {
    years = [], months = [], products = [], locations = [],
    materials = [],
  } = options;

  const totalActive =
    (filters.years?.length || 0) + (filters.months?.length || 0) +
    (filters.products?.length || 0) + (filters.locations?.length || 0) +
    (filters.materials?.length || 0) + (filters.dates?.length || 0) +
    (filters.days?.length || 0);

  const set = (key, val) => onChange({ ...filters, [key]: val });

  const yearOpts  = years.map(String);
  const monthOpts = months.map((m) => ({ value: String(m.index), label: m.name }));

  return (
    <div className={cn('rounded-xl border border-border/60 bg-card/60 backdrop-blur p-4', compact && 'p-3')}>
      <div className="flex items-center gap-2 mb-3">
        <Filter className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Filters</span>
        {totalActive > 0 && (
          <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
            {totalActive}
          </span>
        )}
        {totalActive > 0 && (
          <button
            onClick={() => onChange({ years:[], months:[], products:[], locations:[], materials:[], dates:[], days:[] })}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="size-3" /> Reset all
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {yearOpts.length > 0 && (
          <MultiSelect
            label="Year"
            options={yearOpts}
            selected={filters.years || []}
            onChange={(v) => set('years', v)}
          />
        )}
        {monthOpts.length > 0 && (
          <MultiSelect
            label="Month"
            options={monthOpts}
            selected={filters.months || []}
            onChange={(v) => set('months', v)}
          />
        )}
        {products.length > 0 && (
          <MultiSelect
            label="Product"
            options={products}
            selected={filters.products || []}
            onChange={(v) => set('products', v)}
          />
        )}
        {locations.length > 0 && (
          <MultiSelect
            label="Location"
            options={locations}
            selected={filters.locations || []}
            onChange={(v) => set('locations', v)}
            searchable
          />
        )}
        {materials.length > 0 && (
          <MaterialSelect
            materials={materials}
            selected={filters.materials || []}
            onChange={(v) => set('materials', v)}
          />
        )}
        <CalendarDateSelect
          selected={filters.dates || []}
          onChange={(v) => set('dates', v)}
        />
        {/* Days / Age Bucket filter — uses correct labels matching backend bucketToSql() */}
        <MultiSelect
          label="Age Bucket"
          options={DAYS_OPTIONS}
          selected={filters.days || []}
          onChange={(v) => set('days', v)}
        />
      </div>

      <FilterChips
        filters={filters}
        onChange={(key, val) => set(key, val)}
      />
    </div>
  );
}
