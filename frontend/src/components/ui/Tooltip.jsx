import { cn } from '../../lib/utils';

export function Tooltip({ children }) {
  return <div className="group relative inline-flex">{children}</div>;
}

export function TooltipTrigger({ children, render }) {
  return render || children;
}

export function TooltipContent({ children, side = 'right', sideOffset = 4, className }) {
  const positionClasses = {
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  };

  return (
    <div
      className={cn(
        'invisible group-hover:visible absolute z-50 rounded-md border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md whitespace-nowrap',
        positionClasses[side],
        className
      )}
      style={{ marginLeft: side === 'right' ? sideOffset : undefined, marginRight: side === 'left' ? sideOffset : undefined }}
    >
      {children}
    </div>
  );
}
