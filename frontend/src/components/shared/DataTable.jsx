import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
import { motion } from 'framer-motion';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

export function DataTable({
  columns,
  data,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  isLoading = false,
  className,
  onRowClick,
}) {
  const [sorting, setSorting] = useState([]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      const newSorting =
        typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(newSorting);
      if (onSortChange && newSorting.length > 0) {
        onSortChange(
          newSorting[0].id,
          newSorting[0].desc ? 'desc' : 'asc'
        );
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: !!onSortChange,
    manualPagination: true,
    pageCount: totalPages,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className={cn(
        'rounded-xl border border-border bg-card shadow-sm overflow-hidden',
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-border"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30',
                      header.column.getCanSort() &&
                        'cursor-pointer select-none hover:text-foreground transition-colors'
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1.5">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      {header.column.getCanSort() && (
                        <span className="flex-shrink-0">
                          {header.column.getIsSorted() === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: pageSize > 10 ? 10 : pageSize }).map(
                (_, i) => (
                  <tr
                    key={`skeleton-${i}`}
                    className="border-b border-border/50"
                  >
                    {columns.map((_, c) => (
                      <td key={c} className="px-4 py-3">
                        <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                )
              )
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-16 text-center text-sm text-muted-foreground"
                >
                  No records found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-border/50 transition-colors hover:bg-muted/30',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3 text-sm text-foreground whitespace-nowrap"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Showing {Math.min((page - 1) * pageSize + 1, total)} to{' '}
            {Math.min(page * pageSize, total)} of {total.toLocaleString()}{' '}
            results
          </span>
          <span className="mx-2 text-border">|</span>
          <label className="flex items-center gap-1.5">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary/40"
            >
              {[25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="px-3 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
