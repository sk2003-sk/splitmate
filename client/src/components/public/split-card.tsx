import { Link } from 'react-router-dom';
import { ArrowUpRight, Receipt, Users } from 'lucide-react';
import { formatMoney, timeAgo } from '@/lib/utils';
import type { PublicSplitListItem } from '@/types';

export function PublicSplitCard({ split }: { split: PublicSplitListItem }) {
  return (
    <Link
      to={`/split/${split.code}`}
      className="group relative flex min-w-[250px] flex-col justify-between overflow-hidden rounded-lg border border-border/70 bg-card p-4 transition duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lift sm:min-w-[280px]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_100%_0%,rgba(229,9,20,0.16),transparent_55%)] opacity-0 transition group-hover:opacity-100" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Live split</p>
          <h3 className="mt-1 line-clamp-2 font-display text-2xl font-semibold uppercase leading-[1.05]">
            {split.title}
          </h3>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
      </div>
      <div className="relative mt-6 flex items-end justify-between gap-3">
        <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {split.peopleCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Receipt className="h-3.5 w-3.5" /> {split.expenseCount}
          </span>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-semibold tabular-nums">{formatMoney(split.totalPaise)}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            updated {timeAgo(split.updatedAt)}
          </p>
        </div>
      </div>
    </Link>
  );
}
