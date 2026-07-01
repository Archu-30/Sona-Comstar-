"use client";

import { useState, useRef, useCallback, type ReactNode } from "react";
import ReactECharts, { type EChartsOption } from "echarts-for-react";
import { motion } from "framer-motion";
import {
  Maximize2,
  Minimize2,
  Download,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ChartFilter {
  label: string;
  value: string;
}

export interface ChartContainerProps {
  title: string;
  subtitle?: string;
  option?: EChartsOption;
  height?: number | string;
  loading?: boolean;
  filters?: {
    options: ChartFilter[];
    value: string;
    onChange: (value: string) => void;
  };
  index?: number;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
}

export function ChartContainer({
  title,
  subtitle,
  option,
  height = 350,
  loading = false,
  filters,
  index = 0,
  fullWidth = false,
  className,
  children,
}: ChartContainerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartRef = useRef<ReactECharts | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const exportImage = useCallback(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    const url = instance.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: "#ffffff",
    });
    const link = document.createElement("a");
    link.download = `${title.replace(/\s+/g, "_").toLowerCase()}.png`;
    link.href = url;
    link.click();
  }, [title]);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 + index * 0.1, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border",
        "bg-card shadow-sm",
        "p-5",
        fullWidth ? "col-span-full" : "",
        isFullscreen && "fixed inset-0 z-50 rounded-none bg-background",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {filters && (
            <select
              value={filters.value}
              onChange={(e) => filters.onChange(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
            >
              {filters.options.map((f) => (
                <option key={f.value} value={f.value} className="bg-card">
                  {f.label}
                </option>
              ))}
            </select>
          )}

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={exportImage}
            title="Export as image"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Chart or loading */}
      {loading ? (
        <div
          className="flex items-center justify-center"
          style={{ height }}
        >
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : children ? (
        children
      ) : (
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ height, width: "100%" }}
          opts={{ renderer: "canvas" }}
          notMerge
          lazyUpdate
        />
      )}
    </motion.div>
  );
}
