import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { PublicSplitCard } from '@/components/public/split-card';
import { buttonVariants } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { PublicSplitListItem } from '@/types';

export default function PublicSplitsPage() {
  const splitsQuery = useQuery({
    queryKey: ['public-splits'],
    queryFn: async () => {
      const { data } = await api.get('/api/public/splits');
      return data.splits as PublicSplitListItem[];
    },
  });

  const splits = splitsQuery.data || [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col gap-4 border-b border-border/60 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-primary">Public board</p>
          <h1 className="mt-2 font-display text-5xl font-extrabold uppercase leading-none sm:text-6xl">
            Recent splits
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Every split here is open. Anyone can view it; anyone with the link can add people and
            expenses. No account required.
          </p>
        </div>
        <Link to="/split/new" className={buttonVariants({ size: 'lg' })}>
          <Plus className="h-4 w-4" /> Start a split
        </Link>
      </div>

      {splitsQuery.isLoading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="h-44 animate-pulse rounded-lg bg-card/70" />
          ))}
        </div>
      ) : splits.length ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {splits.map((split) => (
            <PublicSplitCard key={split.code} split={split} />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-lg border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="font-display text-4xl font-semibold uppercase">The board is empty</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Start the first split of the night. Add your people, log who paid, share the link.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link to="/split/new" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Start a split
            </Link>
            <button
              type="button"
              onClick={() => splitsQuery.refetch()}
              className={buttonVariants({ variant: 'outline' })}
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
