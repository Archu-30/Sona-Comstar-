import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Multi-select dropdown filter.
 * - `options`: array of { value, label } or plain strings
 * - `selected`: array of selected values; empty array = "All"
 * - `onChange(nextSelected)`: called with the new array
 */
export function MultiSelect({ label, options, selected, onChange, className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const opts = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o
  );

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const toggle = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const allSelected = selected.length === 0;
  const summary = allSelected
    ? 'All'
    : selected.length <= 2
      ? selected.join(', ')
      : `${selected.length} selected`;

  return (
    <div ref={ref} className={cn('relative', className)}>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full min-w-[140px] items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-sm text-foreground hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring/50"
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 max-h-64 w-full min-w-[180px] overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg">
          <button
            type="button"
            onClick={() => onChange([])}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50"
          >
            <span className={cn('flex h-4 w-4 items-center justify-center rounded border', allSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
              {allSelected && <Check className="h-3 w-3" />}
            </span>
            All
          </button>
          <div className="my-1 h-px bg-border/60" />
          {opts.map((o) => {
            const isSel = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50"
              >
                <span className={cn('flex h-4 w-4 items-center justify-center rounded border', isSel ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                  {isSel && <Check className="h-3 w-3" />}
                </span>
                <span className="truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
