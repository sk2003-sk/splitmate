import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  Globe,
  HandCoins,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Receipt,
  Scale,
  Search,
  Settings,
  Sun,
  Users,
  UsersRound,
  User,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '@/components/brand';
import { TrackPaymentsDialog } from '@/components/track-payments-dialog';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/context/theme';
import { api, apiError } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';
import type { NotificationItem, Paginated, User as UserType } from '@/types';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { resolved, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('splitmate-sidebar') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [trackPromptOpen, setTrackPromptOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && !user.paymentPromptSeen) setTrackPromptOpen(true);
  }, [user?._id, user?.paymentPromptSeen]);

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'inbox'],
    queryFn: async () => {
      const { data } = await api.get('/api/notifications?limit=8');
      return data as Paginated<NotificationItem> & { unreadCount: number };
    },
    refetchInterval: 60_000,
    enabled: Boolean(user),
  });

  const demoUsersQuery = useQuery({
    queryKey: ['demo-users'],
    queryFn: async () => {
      const { data } = await api.get('/api/auth/demo-users');
      return data.users as UserType[];
    },
    enabled: Boolean(user?.isDemo),
    retry: false,
  });

  const markAllRead = useMutation({
    mutationFn: async () => api.put('/api/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const switchAccount = async (target: UserType) => {
    try {
      const { data } = await api.post('/api/auth/demo', { userId: target._id });
      queryClient.setQueryData(['me'], data.user);
      queryClient.removeQueries({ predicate: (entry) => entry.queryKey[0] !== 'me' });
      toast.success(`Signed in as ${data.user.name}`);
      navigate('/dashboard');
    } catch (error) {
      toast.error(apiError(error));
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const unread = notificationsQuery.data?.unreadCount || 0;
  const nav = useMemo<NavItem[]>(
    () => [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/payments', label: 'All payments', icon: WalletCards },
      { to: '/splits', label: 'Public splits', icon: Globe },
      { to: '/expenses', label: 'Expenses', icon: Receipt },
      { to: '/balances', label: 'Balances', icon: Scale },
      { to: '/settlements', label: 'Settlements', icon: HandCoins },
      { to: '/groups', label: 'Groups', icon: UsersRound },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/activity', label: 'Activity', icon: History },
      { to: '/notifications', label: 'Notifications', icon: Bell, badge: unread },
      { to: '/members', label: 'Members', icon: Users },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
    [unread],
  );

  if (!user) return null;

  const toggleSidebar = () => {
    setCollapsed((value) => {
      localStorage.setItem('splitmate-sidebar', value ? '0' : '1');
      return !value;
    });
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    navigate(query.trim() ? `/expenses?q=${encodeURIComponent(query.trim())}` : '/expenses');
  };

  const navList = (compact: boolean) => (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          title={compact ? item.label : undefined}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              compact && 'justify-center px-0',
            )
          }
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" />
          {!compact ? <span className="flex-1 truncate">{item.label}</span> : null}
          {item.badge ? (
            <Badge
              variant="default"
              className={cn('min-w-5 justify-center px-1.5', compact && 'absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[9px]')}
            >
              {item.badge > 9 ? '9+' : item.badge}
            </Badge>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          'no-print fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border/70 bg-card/80 backdrop-blur-xl transition-[width] duration-300 lg:flex',
          collapsed ? 'w-[76px]' : 'w-[248px]',
        )}
      >
        <div className={cn('flex h-16 items-center px-4', collapsed && 'justify-center px-0')}>
          <Link to="/dashboard" aria-label="SplitMate dashboard">
            <Logo compact={collapsed} />
          </Link>
        </div>
        <div className="mt-4 flex flex-1 flex-col overflow-y-auto pb-4">{navList(collapsed)}</div>
        <div className="border-t border-border/70 p-3">
          {!collapsed ? (
            <Link
              to="/profile"
              className="mb-2 flex items-center gap-3 rounded-xl bg-muted/60 p-2.5 transition hover:bg-accent"
            >
              <Avatar name={user.name} color={user.avatarColor} src={user.avatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
              </div>
            </Link>
          ) : (
            <Link to="/profile" className="mb-2 flex justify-center">
              <Avatar name={user.name} color={user.avatarColor} src={user.avatarUrl} />
            </Link>
          )}
          <div className={cn('flex gap-1', collapsed && 'flex-col items-center')}>
            <Button variant="ghost" size="sm" onClick={toggleSidebar} title="Toggle sidebar" className={cn(collapsed && 'w-10 px-0')}>
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              {!collapsed ? <span>Collapse</span> : null}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="Sign out"
              onClick={async () => {
                await logout();
                navigate('/');
              }}
              className={cn(collapsed && 'w-10 px-0')}
            >
              <LogOut className="h-4 w-4" />
              {!collapsed ? <span>Sign out</span> : null}
            </Button>
          </div>
        </div>
      </aside>

      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-300', collapsed ? 'lg:pl-[76px]' : 'lg:pl-[248px]')}>
        <header className="no-print sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-6">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <Link to="/dashboard" className="lg:hidden">
              <Logo compact />
            </Link>

            <form onSubmit={submitSearch} className="relative ml-1 hidden max-w-md flex-1 md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search expenses…"
                className="h-10 w-full rounded-md border border-border bg-card/80 pl-9 pr-16 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                ⌘K
              </kbd>
            </form>

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <Button variant="ghost" size="icon" onClick={toggle} title="Toggle theme">
                {resolved === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative" title="Notifications">
                    <Bell className="h-[18px] w-[18px]" />
                    {unread ? (
                      <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[320px] p-0">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <p className="text-sm font-semibold">Notifications</p>
                    {unread ? (
                      <button
                        type="button"
                        onClick={() => markAllRead.mutate()}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Mark all read
                      </button>
                    ) : null}
                  </div>
                  <div className="max-h-80 overflow-y-auto p-1.5">
                    {notificationsQuery.data?.items.length ? (
                      notificationsQuery.data.items.map((item) => (
                        <DropdownMenuItem
                          key={item._id}
                          className="items-start gap-3 py-2.5"
                          onSelect={() => {
                            if (!item.read) {
                              api.put(`/api/notifications/${item._id}/read`).then(() => {
                                queryClient.invalidateQueries({ queryKey: ['notifications'] });
                              });
                            }
                            if (item.link) navigate(item.link);
                          }}
                        >
                          <span
                            className={cn(
                              'mt-1 h-2 w-2 shrink-0 rounded-full',
                              item.read ? 'bg-border' : 'bg-primary',
                            )}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold">{item.title}</span>
                            <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">
                              {item.message}
                            </span>
                            <span className="mt-1 block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                              {timeAgo(item.createdAt)}
                            </span>
                          </span>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                        You're all caught up.
                      </p>
                    )}
                  </div>
                  <div className="border-t border-border p-2">
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('/notifications')}>
                      View all notifications
                    </Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="ml-1 flex items-center gap-2 rounded-full p-1 transition hover:bg-accent"
                    title="Account menu"
                  >
                    <Avatar name={user.name} color={user.avatarColor} src={user.avatarUrl} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="normal-case tracking-normal">
                    <p className="text-sm font-semibold text-foreground">{user.name}</p>
                    <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Current user · {user.isDemo ? 'Demo account' : 'Member'}
                    </p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate('/profile')}>
                    <User className="h-4 w-4" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/settings')}>
                    <Settings className="h-4 w-4" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/balances')}>
                    <Scale className="h-4 w-4" /> Balances
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {demoUsersQuery.data && demoUsersQuery.data.length > 1 ? (
                    <>
                      <DropdownMenuLabel>Switch account</DropdownMenuLabel>
                      {demoUsersQuery.data
                        .filter((candidate) => candidate._id !== user._id)
                        .slice(0, 6)
                        .map((candidate) => (
                          <DropdownMenuItem key={candidate._id} onSelect={() => switchAccount(candidate)}>
                            <Avatar
                              name={candidate.name}
                              color={candidate.avatarColor}
                              src={candidate.avatarUrl}
                              size="sm"
                            />
                            <span className="truncate">{candidate.name}</span>
                          </DropdownMenuItem>
                        ))}
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  <DropdownMenuItem
                    onSelect={async () => {
                      await logout();
                      navigate('/');
                    }}
                    className="text-rose-600 focus:bg-rose-500/10 focus:text-rose-600 dark:text-rose-400"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="grid-glow flex-1 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.04),transparent_35%)]">
          <div className="mx-auto w-full max-w-[1240px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="mb-6 mt-1 flex items-center gap-3">
            <Logo />
          </div>
          <div className="-mx-3 flex flex-1 flex-col">
            {navList(false)}
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <Link to="/profile" className="flex items-center gap-3 rounded-xl bg-muted/60 p-2.5">
              <Avatar name={user.name} color={user.avatarColor} src={user.avatarUrl} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
              </div>
            </Link>
            <div className="mt-2 flex items-center gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={toggle}>
                {resolved === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {resolved === 'dark' ? 'Light mode' : 'Dark mode'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await logout();
                  navigate('/');
                }}
              >
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <TrackPaymentsDialog open={trackPromptOpen} onOpenChange={setTrackPromptOpen} />
    </div>
  );
}
