import { useEffect } from 'react';
import { cn } from '../../lib/utils';

export function Sheet({ open, onOpenChange, children }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={() => onOpenChange(false)}
      />
      {children}
    </>
  );
}

export function SheetContent({ side = 'left', className, children }) {
  return (
    <div
      className={cn(
        'fixed inset-y-0 z-50 bg-background shadow-xl transition-transform',
        side === 'left' ? 'left-0' : 'right-0',
        className
      )}
    >
      {children}
    </div>
  );
}

export function SheetHeader({ className, children }) {
  return <div className={cn('px-4 py-3', className)}>{children}</div>;
}

export function SheetTitle({ className, children }) {
  return <h2 className={cn('text-lg font-semibold', className)}>{children}</h2>;
}
