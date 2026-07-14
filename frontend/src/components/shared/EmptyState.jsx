import { Inbox } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

export function EmptyState({
  icon: Icon = Inbox,
  title = 'No data found',
  description = 'There are no records to display at this time.',
  actionLabel,
  onAction,
  className,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted border border-border mb-4">
        <Icon className="h-8 w-8 text-muted-foreground/60" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
