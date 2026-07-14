import { cn } from '../../lib/utils';

const variantStyles = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
  outline: 'border border-border bg-background hover:bg-muted text-foreground shadow-sm',
  ghost: 'hover:bg-muted text-foreground',
  destructive: 'bg-destructive text-white hover:bg-destructive/90 shadow-sm',
};

const sizeStyles = {
  default: 'h-9 px-4 py-2 text-sm',
  sm: 'h-8 px-3 text-xs',
  icon: 'h-9 w-9',
  'icon-sm': 'h-8 w-8',
  'icon-xs': 'h-7 w-7',
};

export function Button({
  variant = 'default',
  size = 'default',
  className,
  children,
  ...props
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
