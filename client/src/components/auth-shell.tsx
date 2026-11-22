import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BadgeCheck, Moon, ShieldCheck, Sparkles, Sun, TrendingUp } from 'lucide-react';
import { Logo } from '@/components/brand';
import { useTheme } from '@/context/theme';
import { Button } from '@/components/ui/button';

const HIGHLIGHTS = [
  {
    icon: TrendingUp,
    title: 'Every paisa accounted for',
    description: 'Integer-paise math, equal, exact, percentage, shares and custom splits.',
  },
  {
    icon: Sparkles,
    title: 'Settle without awkwardness',
    description: 'Smart debt simplification shows the fewest transfers that clear the group.',
  },
  {
    icon: ShieldCheck,
    title: 'Built to be trusted',
    description: 'Bcrypt-hashed passwords, JWT sessions and MongoDB persistence across devices and restarts.',
  },
];

export function AuthShell({ children }: { children: ReactNode }) {
  const { resolved, toggle } = useTheme();

  return (
    <div className="relative min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        <div className="relative hidden overflow-hidden bg-[#070707] p-10 text-white lg:flex lg:flex-col">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(229,9,20,0.5),transparent_48%),radial-gradient(circle_at_85%_90%,rgba(229,9,20,0.22),transparent_45%)]" />
          <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
          <span aria-hidden className="pointer-events-none absolute -bottom-24 -right-10 select-none font-display text-[22rem] font-extrabold leading-none text-primary/10">₹</span>
          <div className="relative z-10 flex flex-1 flex-col">
            <Logo />
            <div className="mt-auto max-w-md">
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-primary">
                  Shared money, simplified
                </p>
                <h1 className="mt-4 font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-tight">
                  Split the bill.
                  <br />
                  <span className="text-white/50">Keep the night.</span>
                </h1>
                <p className="mt-4 text-sm leading-relaxed text-neutral-400">
                  SplitMate is the home for shared spending — trips, rent, dinners and everything in
                  between. Real balances, real history, stored in MongoDB.
                </p>
              </motion.div>
              <div className="mt-10 space-y-4">
                {HIGHLIGHTS.map((entry, index) => (
                  <motion.div
                    key={entry.title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.15 + index * 0.08 }}
                    className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/20 text-primary">
                      <entry.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{entry.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">{entry.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <p className="mt-8 flex items-center gap-2 text-[11px] text-neutral-400">
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-400" />
                Payments are tracked internally — SplitMate never claims money moved.
              </p>
            </div>
          </div>
        </div>

        <div className="relative flex flex-col px-5 py-8 sm:px-10">
          <div className="flex items-center justify-between gap-2">
            <div className="lg:hidden">
              <Logo />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Link
                to="/splits"
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Public splits
              </Link>
              <Button variant="ghost" size="icon" onClick={toggle} title="Toggle theme">
                {resolved === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
            {children}
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            Public splits need no account — or keep a ledger with groups and settlements.
          </p>
        </div>
      </div>
    </div>
  );
}
