import { useState, useRef, useEffect, createContext, useContext } from 'react';
import { cn } from '../../lib/utils';

const DropdownContext = createContext({ open: false, setOpen: () => {} });

export function DropdownMenu({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </DropdownContext.Provider>
  );
}

export function DropdownMenuTrigger({ children, render, className, ...props }) {
  const { open, setOpen } = useContext(DropdownContext);
  const child = render || children;

  const handleClick = (e) => {
    e.stopPropagation();
    setOpen(!open);
  };

  if (render) {
    return (
      <div onClick={handleClick} className={cn('cursor-pointer', className)} {...props}>
        {render}
      </div>
    );
  }

  return (
    <div onClick={handleClick} className={cn('cursor-pointer', className)} {...props}>
      {children}
    </div>
  );
}

export function DropdownMenuContent({ children, align = 'start', className }) {
  const { open, setOpen } = useContext(DropdownContext);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={cn(
        'absolute z-50 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-card p-1 shadow-lg',
        align === 'end' ? 'right-0' : 'left-0',
        'top-full mt-1',
        className
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({ children, onClick, className, ...props }) {
  const { setOpen } = useContext(DropdownContext);

  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer',
        className
      )}
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuLabel({ children, className }) {
  return (
    <div className={cn('px-2 py-1.5 text-sm font-semibold', className)}>
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({ className }) {
  return <div className={cn('-mx-1 my-1 h-px bg-border', className)} />;
}

export function DropdownMenuGroup({ children }) {
  return <div>{children}</div>;
}
