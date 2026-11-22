import { cn } from '@/lib/utils';

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-baseline select-none', className)}>
      <span className="font-display text-[27px] font-extrabold uppercase leading-none tracking-tight text-primary">
        {compact ? 'SM' : 'SplitMate'}
      </span>
    </span>
  );
}
