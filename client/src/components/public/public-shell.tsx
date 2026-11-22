import { Link, NavLink, Outlet } from 'react-router-dom';
import { Moon, Plus, Sun } from 'lucide-react';
import { Logo } from '@/components/brand';
import { buttonVariants } from '@/components/ui/button';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/context/theme';
import { cn } from '@/lib/utils';

const navLink = ({ isActive }: { isActive: boolean }) =>
  cn(
    'text-[13px] font-medium transition',
    isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
  );

export function PublicShell() {
  const { user } = useAuth();
  const { resolved, toggle } = useTheme();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 bg-gradient-to-b from-background via-background/95 to-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" aria-label="SplitMate home">
            <Logo />
          </Link>
          <nav className="ml-5 hidden items-center gap-5 md:flex">
            <NavLink to="/splits" className={navLink}>
              Recent splits
            </NavLink>
            <NavLink to="/login" className={navLink}>
              Your ledger
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              title="Toggle theme"
              className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              {resolved === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
            {user ? (
              <Link
                to="/dashboard"
                className="hidden text-[13px] font-medium text-muted-foreground transition hover:text-foreground sm:block"
              >
                Open ledger
              </Link>
            ) : (
              <Link
                to="/login"
                className="hidden text-[13px] font-medium text-muted-foreground transition hover:text-foreground sm:block"
              >
                Sign in
              </Link>
            )}
            <Link to="/split/new" className={cn(buttonVariants({ size: 'sm' }), 'text-[13px]')}>
              <Plus className="h-4 w-4" /> Start a split
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-border/60 bg-card/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <Logo />
            <p className="mt-3 max-w-md text-xs leading-relaxed">
              Public splits need no account. Add people by name, log who paid and everyone sees
              exactly who owes whom.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium">
            <Link to="/splits" className="hover:text-foreground">
              Recent splits
            </Link>
            <Link to="/split/new" className="hover:text-foreground">
              Start a split
            </Link>
            <Link to="/login" className="hover:text-foreground">
              Personal ledger
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
