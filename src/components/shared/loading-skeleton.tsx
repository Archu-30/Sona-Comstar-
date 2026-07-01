"use client";

import { cn } from "@/lib/utils";

function Pulse({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )}
      style={style}
    />
  );
}

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({
  rows = 8,
  columns = 6,
  className,
}: TableSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden",
        className
      )}
    >
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Pulse className="h-9 w-64" />
        <div className="ml-auto flex gap-2">
          <Pulse className="h-9 w-24" />
          <Pulse className="h-9 w-24" />
        </div>
      </div>

      <div className="flex gap-4 px-4 py-3 border-b border-border">
        {Array.from({ length: columns }).map((_, i) => (
          <Pulse key={i} className="h-4 flex-1" />
        ))}
      </div>

      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex gap-4 px-4 py-3 border-b border-border/50"
        >
          {Array.from({ length: columns }).map((_, c) => (
            <Pulse
              key={c}
              className={cn("h-4 flex-1", c === 0 && "max-w-[180px]")}
            />
          ))}
        </div>
      ))}

      <div className="flex items-center justify-between p-4">
        <Pulse className="h-4 w-48" />
        <Pulse className="h-9 w-64" />
      </div>
    </div>
  );
}

export interface KPISkeletonProps {
  count?: number;
  className?: string;
}

export function KPISkeleton({ count = 4, className }: KPISkeletonProps) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <Pulse className="h-4 w-24" />
            <Pulse className="h-8 w-8 rounded-lg" />
          </div>
          <Pulse className="h-8 w-32 mb-2" />
          <Pulse className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export interface ChartSkeletonProps {
  height?: number;
  className?: string;
}

export function ChartSkeleton({
  height = 350,
  className,
}: ChartSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5",
        className
      )}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <Pulse className="h-5 w-40 mb-2" />
          <Pulse className="h-3 w-56" />
        </div>
        <Pulse className="h-9 w-28" />
      </div>
      <Pulse className="w-full" style={{ height }} />
    </div>
  );
}

export interface PageSkeletonProps {
  className?: string;
}

export function PageSkeleton({ className }: PageSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <Pulse className="h-3 w-48" />
        <Pulse className="h-8 w-72" />
        <Pulse className="h-4 w-96" />
      </div>
      <KPISkeleton />
      <ChartSkeleton />
      <TableSkeleton />
    </div>
  );
}
