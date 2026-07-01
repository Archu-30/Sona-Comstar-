"use client";

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  color?: "blue" | "green" | "red" | "amber" | "purple" | "cyan";
  /** Optional array of values (0-100) for a tiny bar chart */
  bars?: number[];
  className?: string;
}

const colorMap: Record<string, { accent: string; bg: string; bar: string }> = {
  blue: {
    accent: "text-blue-600",
    bg: "bg-blue-500/10 border-blue-500/20",
    bar: "bg-blue-500",
  },
  green: {
    accent: "text-emerald-600",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    bar: "bg-emerald-500",
  },
  red: {
    accent: "text-red-600",
    bg: "bg-red-500/10 border-red-500/20",
    bar: "bg-red-500",
  },
  amber: {
    accent: "text-amber-600",
    bg: "bg-amber-500/10 border-amber-500/20",
    bar: "bg-amber-500",
  },
  purple: {
    accent: "text-purple-600",
    bg: "bg-purple-500/10 border-purple-500/20",
    bar: "bg-purple-500",
  },
  cyan: {
    accent: "text-cyan-600",
    bg: "bg-cyan-500/10 border-cyan-500/20",
    bar: "bg-cyan-500",
  },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  color = "blue",
  bars,
  className,
}: StatCardProps) {
  const c = colorMap[color] ?? colorMap.blue;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3",
        className
      )}
    >
      {Icon && (
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
            c.bg
          )}
        >
          <Icon className={cn("h-4 w-4", c.accent)} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className={cn("text-lg font-bold tracking-tight text-foreground")}>
          {value}
        </p>
      </div>

      {bars && bars.length > 0 && (
        <div className="flex items-end gap-[2px] h-8">
          {bars.map((v, i) => (
            <div
              key={i}
              className={cn("w-[4px] rounded-full opacity-70", c.bar)}
              style={{ height: `${Math.max(v, 4)}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
