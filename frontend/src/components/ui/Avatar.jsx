import { useState } from 'react';
import { cn } from '../../lib/utils';

export function Avatar({ className, children }) {
  return (
    <div
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full',
        className
      )}
    >
      {children}
    </div>
  );
}

export function AvatarImage({ src, alt, className }) {
  const [error, setError] = useState(false);

  if (!src || error) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={cn('aspect-square h-full w-full object-cover', className)}
      onError={() => setError(true)}
    />
  );
}

export function AvatarFallback({ className, children }) {
  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-muted',
        className
      )}
    >
      {children}
    </div>
  );
}
