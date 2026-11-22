import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type Tone = 'primary' | 'positive' | 'negative' | 'neutral' | 'warning';

const toneStyles: Record<Tone, { icon: string; value: string; glow: string }> = {
  primary: {
    icon: 'bg-primary/10 text-primary',
    value: 'text-foreground',
    glow: 'from-primary/10',
  },
  positive: {
    icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    value: 'text-emerald-600 dark:text-emerald-400',
    glow: 'from-emerald-500/10',
  },
  negative: {
    icon: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    value: 'text-rose-600 dark:text-rose-400',
    glow: 'from-rose-500/10',
  },
  neutral: {
    icon: 'bg-secondary text-muted-foreground',
    value: 'text-foreground',
    glow: 'from-foreground/5',
  },
  warning: {
    icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    value: 'text-foreground',
    glow: 'from-amber-500/10',
  },
};

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
  index?: number;
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'primary', index = 0 }: StatCardProps) {
  const styles = toneStyles[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div
        className={cn(
          'pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br to-transparent blur-2xl transition group-hover:scale-125',
          styles.glow,
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className={cn('mt-2 font-display text-[26px] font-bold leading-tight tracking-tight', styles.value)}>
            {value}
          </p>
          {hint ? <p className="mt-1.5 truncate text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', styles.icon)}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
    </motion.div>
  );
}
