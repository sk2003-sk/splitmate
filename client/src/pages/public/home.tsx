import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, HandCoins, Play, ReceiptText, UserPlus } from 'lucide-react';
import { PublicSplitCard } from '@/components/public/split-card';
import { buttonVariants } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PublicSplitListItem } from '@/types';

const STEPS = [
  {
    icon: UserPlus,
    title: 'Add your people',
    copy: 'Type names. No accounts, no invites, no app installs for anyone in the group.',
  },
  {
    icon: ReceiptText,
    title: 'Log every payment',
    copy: 'Food, cabs, tickets — record who paid and who shared it in a couple of taps.',
  },
  {
    icon: HandCoins,
    title: 'See who pays whom',
    copy: 'One clean settlement list turns a messy day into the fewest possible transfers.',
  },
];

export default function PublicHomePage() {
  const splitsQuery = useQuery({
    queryKey: ['public-splits'],
    queryFn: async () => {
      const { data } = await api.get('/api/public/splits');
      return data.splits as PublicSplitListItem[];
    },
  });

  const splits = splitsQuery.data || [];

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border/50">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(80%_120%_at_85%_-10%,rgba(229,9,20,0.42),transparent_60%),radial-gradient(60%_80%_at_10%_100%,rgba(229,9,20,0.16),transparent_60%)]"
        />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,hsl(var(--background))_2%,transparent_55%)]" />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-6 top-1/2 hidden -translate-y-1/2 select-none font-display text-[24rem] font-extrabold leading-none text-primary/10 lg:block"
        >
          ₹
        </span>
        <div className="relative mx-auto w-full max-w-6xl px-4 pb-20 pt-14 sm:px-6 sm:pb-28 sm:pt-24">
          <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-primary">
            No login · no spreadsheets
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-6xl font-extrabold uppercase leading-[0.88] tracking-tight sm:text-7xl lg:text-[7.5rem]">
            Split the night.
            <br />
            <span className="text-muted-foreground">Not the friendship.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Dinner, cabs, tickets — different people paid for different things. Add everyone by name,
            log what was paid, and let SplitMate show exactly who owes whom. No account needed.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/split/new" className={cn(buttonVariants({ size: 'lg' }), 'gap-2')}>
              <Play className="h-4 w-4 fill-current" /> Start a split
            </Link>
            <Link
              to="/splits"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'lg' }),
                'gap-2 border-border/80 bg-card/40',
              )}
            >
              Browse recent splits <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {['Add people by name', 'Anyone can log a payment', 'Balances update instantly'].map((item) => (
              <li key={item} className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-primary" /> {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-semibold uppercase tracking-tight sm:text-4xl">
              Live splits
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Open tabs anyone can view — and anyone with the link can add to.
            </p>
          </div>
          <Link
            to="/splits"
            className="hidden shrink-0 items-center gap-1 text-[13px] font-semibold text-muted-foreground transition hover:text-primary sm:flex"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-5">
          {splitsQuery.isLoading ? (
            <div className="flex gap-4 overflow-hidden">
              {[0, 1, 2].map((index) => (
                <div key={index} className="h-40 min-w-[250px] animate-pulse rounded-lg bg-card/70 sm:min-w-[280px]" />
              ))}
            </div>
          ) : splits.length ? (
            <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
              {splits.map((split) => (
                <div key={split.code} className="snap-start">
                  <PublicSplitCard split={split} />
                </div>
              ))}
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-lg border border-dashed border-border bg-card/40 px-6 py-10">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_100%_0%,rgba(229,9,20,0.12),transparent_60%)]" />
              <p className="relative text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
                Nothing playing yet
              </p>
              <h3 className="relative mt-2 font-display text-3xl font-semibold uppercase">
                Be the first split
              </h3>
              <p className="relative mt-2 max-w-md text-sm text-muted-foreground">
                Start a tab for tonight. It takes ten seconds — add the group, log the first bill and
                share the link.
              </p>
              <Link to="/split/new" className={cn(buttonVariants(), 'relative mt-5')}>
                <Play className="h-4 w-4 fill-current" /> Start a split
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pt-14 sm:px-6">
        <h2 className="font-display text-3xl font-semibold uppercase tracking-tight sm:text-4xl">
          How the night splits
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <div
              key={step.title}
              className="relative overflow-hidden rounded-lg border border-border/70 bg-card p-5"
            >
              <span className="font-display text-5xl font-extrabold leading-none text-primary/70">
                {String(index + 1).padStart(2, '0')}
              </span>
              <step.icon className="mt-4 h-5 w-5 text-muted-foreground" />
              <h3 className="mt-3 font-display text-2xl font-semibold uppercase leading-tight">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pt-14 sm:px-6">
        <div className="relative overflow-hidden rounded-lg border border-border/60 bg-[linear-gradient(110deg,rgba(229,9,20,0.22),rgba(10,10,10,0.2)_45%,transparent)] px-6 py-10 sm:px-10">
          <div className="relative max-w-2xl">
            <h2 className="font-display text-4xl font-extrabold uppercase leading-[0.95] sm:text-5xl">
              One link. The whole group. Zero awkward maths.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Keep a personal ledger with groups and settlements if you want, but the fastest way to
              settle tonight is a public split.
            </p>
          </div>
          <div className="relative mt-6 flex flex-wrap gap-3">
            <Link to="/split/new" className={buttonVariants()}>
              Start a split
            </Link>
            <Link to="/login" className={buttonVariants({ variant: 'outline' })}>
              Open the ledger instead
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
