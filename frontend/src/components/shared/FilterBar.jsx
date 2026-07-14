import { Search, X, SlidersHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

export function FilterBar({
  filters,
  values,
  activeFilters = [],
  onFilterChange,
  onClear,
  onRemoveFilter,
  children,
  className,
}) {
  const handleRemove = (key) => {
    if (onRemoveFilter) {
      onRemoveFilter(key);
    } else {
      onFilterChange(key, '');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className={cn(
        'rounded-xl border border-border bg-card p-4 space-y-3',
        className
      )}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mr-1">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline font-medium">Filters</span>
        </div>

        {filters.map((filter) => {
          switch (filter.type) {
            case 'search':
              return (
                <div key={filter.key} className="relative min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={values[filter.key] ?? ''}
                    onChange={(e) =>
                      onFilterChange(filter.key, e.target.value)
                    }
                    placeholder={filter.placeholder ?? filter.label}
                    className="pl-8"
                  />
                  {values[filter.key] && (
                    <button
                      onClick={() => onFilterChange(filter.key, '')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );

            case 'select':
              return (
                <select
                  key={filter.key}
                  value={values[filter.key] ?? ''}
                  onChange={(e) =>
                    onFilterChange(filter.key, e.target.value)
                  }
                  className="h-8 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40 transition-colors min-w-[140px]"
                >
                  <option value="">{filter.placeholder ?? filter.label}</option>
                  {filter.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              );

            case 'date':
              return (
                <input
                  key={filter.key}
                  type="date"
                  value={values[filter.key] ?? ''}
                  onChange={(e) =>
                    onFilterChange(filter.key, e.target.value)
                  }
                  className="h-8 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40 transition-colors"
                />
              );

            case 'daterange':
              return (
                <div key={filter.key} className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={values[`${filter.key}_from`] ?? ''}
                    onChange={(e) =>
                      onFilterChange(`${filter.key}_from`, e.target.value)
                    }
                    className="h-8 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40 transition-colors"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <input
                    type="date"
                    value={values[`${filter.key}_to`] ?? ''}
                    onChange={(e) =>
                      onFilterChange(`${filter.key}_to`, e.target.value)
                    }
                    className="h-8 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40 transition-colors"
                  />
                </div>
              );

            default:
              return null;
          }
        })}

        {children}

        {activeFilters.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
            Clear all
          </Button>
        )}
      </div>

      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {activeFilters.map((f) => (
            <span
              key={f.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground"
            >
              <span className="text-muted-foreground">{f.label}:</span>
              <span className="font-medium">{f.displayValue}</span>
              <button
                onClick={() => handleRemove(f.key)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
