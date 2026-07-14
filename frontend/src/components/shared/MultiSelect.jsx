/**
 * MultiSelect.jsx — Professional multi-select dropdown component.
 *
 * Features:
 *  ✓ Search
 *  ✓ Select All / Clear All
 *  ✓ Checkbox selection
 *  ✓ Multiple selection
 *  ✓ Scrollable dropdown
 *  ✓ Portal rendering (fixes z-index / overflow clipping)
 *  ✓ Close on outside click
 *  ✓ Proper z-index (9999)
 *  ✓ Responsive
 *
 * Props:
 *  - label: string
 *  - options: string[] | { value, label }[]
 *  - selected: string[]
 *  - onChange(nextSelected): function
 *  - searchable: boolean (default false)
 *  - className: string
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function MultiSelect({ label, options = [], selected = [], onChange, searchable = false, className }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 200 });
  const triggerRef = useRef(null);
  const dropRef = useRef(null);

  // Normalise options to { value, label } objects
  const opts = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : { value: o.value ?? o.v ?? String(o), label: o.label ?? o.l ?? String(o) }
  );

  const filtered = search
    ? opts.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : opts;

  const isSelected = (value) => selected.includes(value);

  const toggle = (value) => {
    if (isSelected(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  const selectAll = () => onChange(opts.map((o) => o.value));
  const clearAll = () => { onChange([]); setSearch(''); };

  // Calculate portal position
  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setDropPos({
      top:   r.bottom + window.scrollY + 4,
      left:  r.left  + window.scrollX,
      width: Math.max(r.width, 220),
    });
  }, []);

  const handleOpen = () => {
    updatePos();
    setOpen((p) => !p);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropRef.current    && !dropRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onScroll = () => { if (open) updatePos(); };
    document.addEventListener('mousedown', h);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', h);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, updatePos]);

  const allSelected = selected.length === opts.length && opts.length > 0;
  const noneSelected = selected.length === 0;

  const summary = noneSelected
    ? 'All'
    : selected.length === 1
      ? (opts.find((o) => o.value === selected[0])?.label ?? selected[0])
      : `${selected.length} selected`;

  const dropdown = open ? createPortal(
    <div
      ref={dropRef}
      style={{
        position: 'absolute',
        top:   dropPos.top,
        left:  dropPos.left,
        width: dropPos.width,
        zIndex: 9999,
      }}
      className="rounded-xl border border-border bg-background shadow-2xl overflow-hidden"
    >
      {/* Search */}
      {searchable && (
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
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

      {/* Select All / Clear All */}
      <div className="flex items-center gap-3 border-b border-border/50 px-3 py-1.5">
        <button
          onClick={selectAll}
          className="text-xs text-primary hover:underline font-medium"
        >
          Select All
        </button>
        <span className="text-border">|</span>
        <button
          onClick={clearAll}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
        {selected.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {selected.length} of {opts.length}
          </span>
        )}
      </div>

      {/* Options list */}
      <div className="max-h-56 overflow-y-auto overscroll-contain">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No options match</p>
        ) : (
          filtered.map((o) => (
            <label
              key={o.value}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-muted/50 transition-colors text-sm',
                isSelected(o.value) && 'bg-primary/5'
              )}
            >
              <span
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                  isSelected(o.value)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border'
                )}
              >
                {isSelected(o.value) && <Check className="size-3" />}
              </span>
              <span className="truncate flex-1">{o.label}</span>
            </label>
          ))
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className={cn('relative', className)}>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={cn(
          'flex h-9 w-full min-w-[140px] items-center justify-between gap-2 rounded-lg border bg-background px-3 text-sm text-foreground hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors',
          selected.length > 0
            ? 'border-primary/60 bg-primary/5 text-primary font-medium'
            : 'border-border'
        )}
      >
        <span className="truncate flex-1 text-left">{summary}</span>
        {selected.length > 0 && (
          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {selected.length}
          </span>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {dropdown}
    </div>
  );
}
