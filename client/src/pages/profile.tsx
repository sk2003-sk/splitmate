import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  CalendarDays,
  Mail,
  Pencil,
  Receipt,
  Settings,
  Smartphone,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarStack } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/primitives';
import { SkeletonCard, SkeletonRows } from '@/components/ui/skeleton';
import { ExpenseRow } from '@/components/expense-row';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { formatDate, formatMoney, percent } from '@/lib/utils';
import type { AnalyticsSummary, BalancesResponse, Expense, Group, Paginated } from '@/types';

export default function ProfilePage() {
  const { user } = useAuth();

  const summaryQuery = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: async () => {
      const { data } = await api.get('/api/analytics/summary');
      return data as AnalyticsSummary;
    },
  });
  const balancesQuery = useQuery({
    queryKey: ['balances'],
    queryFn: async () => {
      const { data } = await api.get('/api/balances');
      return data as BalancesResponse;
    },
  });
  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data } = await api.get('/api/groups');
      return data.groups as Group[];
    },
  });
  const expensesQuery = useQuery({
    queryKey: ['expenses', 'profile'],
    queryFn: async () => {
      const { data } = await api.get('/api/expenses', { params: { limit: 5 } });
      return data as Paginated<Expense> & { totalPaise: number };
    },
  });

  const summary = summaryQuery.data;
  const budget = user?.monthlyBudgetPaise || 0;
  const spent = summary?.monthlyMySharePaise || 0;
  const used = budget ? percent(spent, budget) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Account"
        title="Your profile"
        description="How you appear to your groups, plus a snapshot of your SplitMate activity."
        actions={
          <>
            <Link to="/settings">
              <Button variant="outline">
                <Settings className="h-4 w-4" /> Settings
              </Button>
            </Link>
            <Link to="/settings">
              <Button>
                <Pencil className="h-4 w-4" /> Edit profile
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardContent className="flex flex-col items-center p-6 text-center">
            <Avatar name={user?.name} color={user?.avatarColor} src={user?.avatarUrl} size="xl" className="h-20 w-20 text-2xl" />
            <h2 className="mt-4 font-display text-xl font-bold">{user?.name}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5" /> {user?.email}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {user?.isDemo ? <Badge variant="warning">Demo account</Badge> : <Badge variant="positive">Active member</Badge>}
              {user?.upiId ? <Badge variant="secondary"><Smartphone className="h-3 w-3" /> {user.upiId}</Badge> : null}
            </div>
            <div className="mt-5 w-full space-y-2 text-left">
              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-2.5 text-xs">
                <span className="text-muted-foreground">Default currency</span>
                <span className="font-semibold">{user?.defaultCurrency || 'INR'}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-2.5 text-xs">
                <span className="text-muted-foreground">Member since</span>
                <span className="font-semibold">{user?.createdAt ? formatDate(user.createdAt) : '—'}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-2.5 text-xs">
                <span className="text-muted-foreground">Groups</span>
                <span className="font-semibold">{groupsQuery.data?.length ?? summary?.groupCount ?? 0}</span>
              </div>
            </div>
            {budget ? (
              <div className="mt-4 w-full text-left">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold">Monthly budget</span>
                  <span className="text-muted-foreground">{formatMoney(spent)} / {formatMoney(budget)}</span>
                </div>
                <Progress value={used} indicatorClassName={used >= 100 ? 'bg-rose-500' : used >= 75 ? 'bg-amber-500' : 'bg-emerald-500'} />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4 xl:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {summaryQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)
            ) : (
              <>
                <Card className="p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your total share</p>
                  <p className="mt-1 font-display text-2xl font-bold">{formatMoney(summary?.mySharePaise || 0)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Across {summary?.expenseCount || 0} visible expenses</p>
                </Card>
                <Card className="p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">You fronted</p>
                  <p className="mt-1 font-display text-2xl font-bold">
                    {formatMoney((balancesQuery.data?.summary.youAreOwedPaise || 0) + (summary?.mySharePaise || 0))}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Your share plus money owed back to you</p>
                </Card>
                <Card className="p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">You owe</p>
                  <p className="mt-1 font-display text-2xl font-bold text-rose-500">{formatMoney(balancesQuery.data?.summary.youOwePaise || 0)}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowLeftRight className="h-3 w-3" /> Settle in Balances
                  </p>
                </Card>
                <Card className="p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">You are owed</p>
                  <p className="mt-1 font-display text-2xl font-bold text-emerald-500">{formatMoney(balancesQuery.data?.summary.youAreOwedPaise || 0)}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Wallet className="h-3 w-3" /> Across all groups
                  </p>
                </Card>
              </>
            )}
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Your groups</CardTitle>
                <CardDescription>Shared spaces you belong to.</CardDescription>
              </div>
              <Link to="/groups">
                <Button variant="ghost" size="sm">View all</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {groupsQuery.isLoading ? (
                <SkeletonRows rows={2} />
              ) : groupsQuery.data?.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {groupsQuery.data.slice(0, 4).map((group) => (
                    <Link key={group._id} to={`/groups/${group._id}`} className="flex items-center gap-3 rounded-xl border border-border/60 p-3 transition hover:border-primary/30 hover:bg-accent/30">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-lg">{group.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{group.name}</p>
                        <p className="text-[11px] text-muted-foreground">{group.memberCount || group.members.length} members</p>
                      </div>
                      <AvatarStack users={group.members} max={3} />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">You are not in any groups yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Recent expenses</CardTitle>
            <CardDescription>Your last five visible transactions.</CardDescription>
          </div>
          <Link to="/expenses">
            <Button variant="ghost" size="sm">
              <Receipt className="h-3.5 w-3.5" /> All expenses
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {expensesQuery.isLoading ? (
            <SkeletonRows rows={4} />
          ) : expensesQuery.data?.items.length ? (
            <div className="divide-y divide-border/50">
              {expensesQuery.data.items.map((expense, index) => (
                <ExpenseRow key={expense._id} expense={expense} index={index} />
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No expenses yet. <Link to="/expenses/new" className="font-semibold text-primary hover:underline">Add one</Link>.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <UsersRound className="h-4 w-4 text-primary" />
          Profile data is stored in MongoDB, not in the browser.
        </span>
        <span className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4" /> Joined {user?.createdAt ? formatDate(user.createdAt, 'long') : '—'}
        </span>
      </div>
    </div>
  );
}
