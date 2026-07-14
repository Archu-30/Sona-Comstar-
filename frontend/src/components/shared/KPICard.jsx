import { useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { cn } from '../../lib/utils';
import { formatCurrency, formatNumber, formatPercent } from '../../lib/formatters';

const colorMap = {
  blue: {
    bg: 'bg-blue-50 border-blue-200/60',
    icon: 'bg-blue-100 text-blue-600',
    spark: '#3b82f6',
  },
  cyan: {
    bg: 'bg-cyan-50 border-cyan-200/60',
    icon: 'bg-cyan-100 text-cyan-600',
    spark: '#06b6d4',
  },
  purple: {
    bg: 'bg-purple-50 border-purple-200/60',
    icon: 'bg-purple-100 text-purple-600',
    spark: '#8b5cf6',
  },
  emerald: {
    bg: 'bg-emerald-50 border-emerald-200/60',
    icon: 'bg-emerald-100 text-emerald-600',
    spark: '#10b981',
  },
  amber: {
    bg: 'bg-amber-50 border-amber-200/60',
    icon: 'bg-amber-100 text-amber-600',
    spark: '#f59e0b',
  },
  rose: {
    bg: 'bg-rose-50 border-rose-200/60',
    icon: 'bg-rose-100 text-rose-600',
    spark: '#f43f5e',
  },
  orange: {
    bg: 'bg-orange-50 border-orange-200/60',
    icon: 'bg-orange-100 text-orange-600',
    spark: '#f97316',
  },
};

function formatValue(val, fmt) {
  switch (fmt) {
    case 'currency':
      return formatCurrency(val);
    case 'percent':
      return formatPercent(val);
    default:
      return formatNumber(val);
  }
}

function AnimatedValue({ value, format: fmt = 'number' }) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const motionVal = useMotionValue(safeValue);
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.textContent = formatValue(safeValue, fmt);
    const controls = animate(motionVal, safeValue, {
      duration: 1.0,
      ease: 'easeOut',
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = formatValue(v, fmt);
      },
    });
    return () => controls.stop();
  }, [safeValue, fmt, motionVal]);

  return <span ref={ref}>{formatValue(safeValue, fmt)}</span>;
}

function Sparkline({ data, color, width = 80, height = 28 }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="opacity-60">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function KPICard({
  label,
  value,
  previousValue,
  format: fmt = 'number',
  icon: Icon,
  color = 'blue',
  sparkline,
  index = 0,
  className,
  suffix,
}) {
  const colors = colorMap[color];

  const change =
    previousValue != null && previousValue !== 0
      ? ((value - previousValue) / Math.abs(previousValue)) * 100
      : undefined;

  const trend =
    change != null ? (change > 0 ? 'up' : change < 0 ? 'down' : 'neutral') : 'neutral';

  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: 'easeOut' }}
      className={cn(
        'relative overflow-hidden rounded-xl border p-5',
        'shadow-sm hover:shadow-md transition-shadow duration-300',
        colors.bg,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-bold tracking-tight text-foreground">
            <AnimatedValue value={value} format={fmt} />
            {suffix && <span className="text-sm font-medium text-muted-foreground">{suffix}</span>}
          </p>
          {change !== undefined && (
            <div className="flex items-center gap-1.5">
              <TrendIcon
                className={cn(
                  'h-3.5 w-3.5',
                  trend === 'up' && 'text-emerald-600',
                  trend === 'down' && 'text-rose-600',
                  trend === 'neutral' && 'text-muted-foreground'
                )}
              />
              <span
                className={cn(
                  'text-xs font-medium',
                  trend === 'up' && 'text-emerald-600',
                  trend === 'down' && 'text-rose-600',
                  trend === 'neutral' && 'text-muted-foreground'
                )}
              >
                {change >= 0 ? '+' : ''}
                {change.toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground">vs prev</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              colors.icon
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          {sparkline && sparkline.length > 1 && (
            <Sparkline data={sparkline} color={colors.spark} />
          )}
        </div>
      </div>
    </motion.div>
  );
}
