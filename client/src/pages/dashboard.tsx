import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  Plus,
  Receipt,
  Scale,
  TrendingUp,
  UserPlus,
  UsersRound,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/primitives';
import { Skeleton, SkeletonCard, SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { ExpenseRow } from '@/components/expense-row';
import { SettleUpDialog } from '@/components/settle-up-dialog';
import { CreateGroupDialog } from '@/components/create-group-dialog';
import { AddMemberDialog } from '@/components/add-member-dialog';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { formatMoney, percent, person, timeAgo } from '@/lib/utils';
import type {
  ActivityItem,
  AnalyticsSummary,
  BalancesResponse,
  CategoryStat,
  Expense,
  MonthlyPoint,
  Paginated,
} from '@/types';

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [settleOpen, setSettleOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);

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
  const monthlyQuery = useQuery({
    queryKey: ['analytics', 'monthly', 6],
    queryFn: async () => {
      const { data } = await api.get('/api/analytics/monthly?months=6');
      return data.months as MonthlyPoint[];
    },
  });
  const categoriesQuery = useQuery({
    queryKey: ['analytics', 'categories'],
    queryFn: async () => {
      const { data } = await api.get('/api/analytics/categories');
      return data.categories as CategoryStat[];
    },
  });
  const recentQuery = useQuery({
    queryKey: ['analytics', 'recent'],
    queryFn: async () => {
      const { data } = await api.get('/api/analytics/recent');
      return data.items as Expense[];
    },
  });
  const activityQuery = useQuery({
    queryKey: ['activity', 'dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/api/activity?limit=6');
      return data as Paginated<ActivityItem>;
    },
  });

  const summary = summaryQuery.data;
  const balances = balancesQuery.data;
  const months = monthlyQuery.data || [];
  const categories = categoriesQuery.data || [];
  const recent = recentQuery.data || [];

  const people = useMemo(() => {
    if (!user || !balances) return { owe: [], owed: [] };
    const owe = balances.pairwise
      .filter((row) => row.from._id === user._id)
      .map((row) => ({ person: row.to, amountPaise: row.amountPaise }));
    const owed = balances.pairwise
      .filter((row) => row.to._id === user._id)
      .map((row) => ({ person: row.from, amountPaise: row.amountPaise }));
    return { owe, owed };
  }, [balances, user]);

  const budget = user?.monthlyBudgetPaise || 0;
  const spentThisMonth = summary?.monthlyMySharePaise || 0;
  const budgetProgress = budget ? percent(spentThisMonth, budget) : 0;
  const topCategories = categories.slice(0, 5);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title={`${greeting}, ${user?.name?.split(' ')[0] || 'there'}`}
        description="Here is the shape of your shared money today — balances, trends and recent movement."
        actions={
          <>
            <Button onClick={() => navigate('/expenses/new')}>
              <Plus className="h-4 w-4" /> Add expense
            </Button>
            <Button variant="outline" onClick={() => setSettleOpen(true)}>
              <Scale className="h-4 w-4" /> Settle up
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summaryQuery.isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <SkeletonCard key={index} />)
        ) : (
          <>
            <StatCard
              index={0}
              label="Total expenses"
              value={formatMoney(summary?.totalExpensesPaise || 0, { compact: true })}
              hint={`${summary?.expenseCount || 0} expenses tracked`}
              icon={Wallet}
            />
            <StatCard
              index={1}
              label="You owe"
              value={formatMoney(summary?.youOwePaise || 0, { compact: true })}
              hint={`${people.owe.length} people to settle`}
              icon={ArrowUpRight}
              tone="negative"
            />
            <StatCard
              index={2}
              label="You are owed"
              value={formatMoney(summary?.youAreOwedPaise || 0, { compact: true })}
              hint={`${people.owed.length} people owe you`}
              icon={ArrowDownLeft}
              tone="positive"
            />
            <StatCard
              index={3}
              label="Total settled"
              value={formatMoney(summary?.settledPaise || 0, { compact: true })}
              hint="Payments recorded"
              icon={Receipt}
              tone="neutral"
            />
            <StatCard
              index={4}
              label="This month"
              value={formatMoney(summary?.monthlySpendPaise || 0, { compact: true })}
              hint={`Your share ${formatMoney(summary?.monthlyMySharePaise || 0, { compact: true })}`}
              icon={CalendarRange}
              tone="warning"
            />
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-3 pb-2">
            <div>
              <CardTitle>Monthly spending</CardTitle>
              <CardDescription>Total group spend vs your share over the last six months.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/analytics')}>
              Analytics <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-2">
            {monthlyQuery.isLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : months.length ? (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={months} margin={{ top: 8, right: 6, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dashSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tickMargin={8} stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      width={62}
                      tickFormatter={(value) => formatMoney(Number(value), { compact: true })}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip
                      formatter={(value) => formatMoney(Number(value))}
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--card))',
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="totalPaise"
                      name="Group spend"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fill="url(#dashSpend)"
                    />
                    <Area
                      type="monotone"
                      dataKey="mySharePaise"
                      name="Your share"
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      fill="transparent"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                icon={BarChart3}
                title="No spending history yet"
                description="Add your first expense to see monthly trends here."
                action={<Button size="sm" onClick={() => navigate('/expenses/new')}>Add expense</Button>}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Spending by category</CardTitle>
            <CardDescription>Where your shared money goes.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {categoriesQuery.isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : topCategories.length ? (
              <>
                <div className="relative h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={topCategories}
                        dataKey="totalPaise"
                        nameKey="name"
                        innerRadius={54}
                        outerRadius={80}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {topCategories.map((entry, index) => (
                          <Cell key={entry.categoryId} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatMoney(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Categorised</span>
                    <span className="font-display text-lg font-bold">
                      {formatMoney(categories.reduce((sum, row) => sum + row.totalPaise, 0), { compact: true })}
                    </span>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {topCategories.map((entry, index) => (
                    <div key={entry.categoryId} className="flex items-center gap-2 text-xs">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: entry.color || PIE_COLORS[index % PIE_COLORS.length] }}
                      />
                      <span className="flex-1 truncate text-muted-foreground">{entry.name}</span>
                      <span className="font-semibold tabular-nums">{formatMoney(entry.totalPaise, { compact: true })}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No categorised spending yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {budget ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>Monthly budget</CardTitle>
              <CardDescription>
                {formatMoney(spentThisMonth)} of {formatMoney(budget)} used this month.
              </CardDescription>
            </div>
            <Badge variant={budgetProgress >= 100 ? 'negative' : budgetProgress >= 75 ? 'warning' : 'positive'}>
              {budgetProgress}% used
            </Badge>
          </CardHeader>
          <CardContent>
            <Progress value={budgetProgress} indicatorClassName={budgetProgress >= 100 ? 'bg-rose-500' : budgetProgress >= 75 ? 'bg-amber-500' : 'bg-emerald-500'} />
            <p className="mt-2 text-xs text-muted-foreground">
              Budget is based on your share of expenses across all groups. Manage it in Settings.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Recent transactions</CardTitle>
              <CardDescription>The latest expenses you are part of.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/expenses')}>
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-1">
            {recentQuery.isLoading ? (
              <SkeletonRows rows={4} />
            ) : recent.length ? (
              <div className="divide-y divide-border/50">
                {recent.map((expense, index) => (
                  <ExpenseRow key={expense._id} expense={expense} index={index} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Receipt}
                title="No expenses yet"
                description="Once you add an expense it will appear here with who paid and your share."
                action={<Button size="sm" onClick={() => navigate('/expenses/new')}>Add first expense</Button>}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-auto flex-col items-start gap-1.5 py-3" onClick={() => navigate('/expenses/new')}>
                <Plus className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold">Add expense</span>
              </Button>
              <Button variant="outline" className="h-auto flex-col items-start gap-1.5 py-3" onClick={() => setSettleOpen(true)}>
                <Scale className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-semibold">Settle up</span>
              </Button>
              <Button variant="outline" className="h-auto flex-col items-start gap-1.5 py-3" onClick={() => setGroupOpen(true)}>
                <UsersRound className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold">Create group</span>
              </Button>
              <Button variant="outline" className="h-auto flex-col items-start gap-1.5 py-3" onClick={() => setMemberOpen(true)}>
                <UserPlus className="h-4 w-4 text-sky-500" />
                <span className="text-xs font-semibold">Add member</span>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>People you owe</CardTitle>
                <Badge variant="negative">{people.owe.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 pt-1">
              {balancesQuery.isLoading ? (
                <SkeletonRows rows={2} />
              ) : people.owe.length ? (
                people.owe.slice(0, 4).map((row) => (
                  <button
                    key={row.person._id}
                    type="button"
                    onClick={() => setSettleOpen(true)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-2 text-left transition hover:bg-accent"
                  >
                    <Avatar name={row.person.name} color={row.person.avatarColor} src={row.person.avatarUrl} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.person.name}</span>
                    <span className="text-xs font-semibold text-rose-500">−{formatMoney(row.amountPaise, { compact: true })}</span>
                  </button>
                ))
              ) : (
                <p className="py-4 text-center text-xs text-muted-foreground">You are all settled up.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>People who owe you</CardTitle>
                <Badge variant="positive">{people.owed.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 pt-1">
              {balancesQuery.isLoading ? (
                <SkeletonRows rows={2} />
              ) : people.owed.length ? (
                people.owed.slice(0, 4).map((row) => (
                  <div key={row.person._id} className="flex items-center gap-2.5 rounded-xl px-1.5 py-2">
                    <Avatar name={row.person.name} color={row.person.avatarColor} src={row.person.avatarUrl} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.person.name}</span>
                    <span className="text-xs font-semibold text-emerald-500">+{formatMoney(row.amountPaise, { compact: true })}</span>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-xs text-muted-foreground">Nobody owes you right now.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Recent group activity</CardTitle>
            <CardDescription>What changed across your shared groups.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/activity')}>
            Full history <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="pt-1">
          {activityQuery.isLoading ? (
            <SkeletonRows rows={3} />
          ) : activityQuery.data?.items.length ? (
            <div className="space-y-1">
              {activityQuery.data.items.map((item) => (
                <div key={item._id} className="flex items-start gap-3 rounded-xl px-1.5 py-2.5">
                  <Avatar name={item.actor?.name} color={item.actor?.avatarColor} src={item.actor?.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{item.message}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {item.group ? <span>{item.group.emoji} {item.group.name} ·</span> : null}
                      <span>{timeAgo(item.createdAt)}</span>
                    </p>
                  </div>
                  {item.amountPaise ? (
                    <span className="shrink-0 text-xs font-semibold tabular-nums">{formatMoney(item.amountPaise)}</span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
          )}
        </CardContent>
      </Card>

      <SettleUpDialog open={settleOpen} onOpenChange={setSettleOpen} />
      <CreateGroupDialog
        open={groupOpen}
        onOpenChange={setGroupOpen}
        onCreated={(group) => navigate(`/groups/${group._id}`)}
      />
      <AddMemberDialog open={memberOpen} onOpenChange={setMemberOpen} />
    </div>
  );
}
