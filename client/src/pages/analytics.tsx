import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  CalendarDays,
  Download,
  Printer,
  TrendingUp,
  UsersRound,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { Avatar } from '@/components/ui/avatar';
import { api, apiError } from '@/lib/api';
import { downloadBlob, formatMoney, monthInput } from '@/lib/utils';
import type {
  CategoryStat,
  DailyPoint,
  Group,
  GroupStat,
  MemberStat,
  MonthlyPoint,
  WeeklyPoint,
} from '@/types';

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RANGES = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'quarter', label: 'Last 3 months' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
];

function toDateInput(date: Date) {
  const copy = new Date(date);
  const offset = copy.getTimezoneOffset();
  return new Date(copy.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function rangeFor(value: string, customFrom: string, customTo: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (value === 'custom') return { from: customFrom, to: customTo };
  if (value === 'week') {
    const day = (now.getDay() + 6) % 7;
    const start = new Date(year, month, now.getDate() - day);
    return { from: toDateInput(start), to: toDateInput(now) };
  }
  if (value === 'month') return { from: toDateInput(new Date(year, month, 1)), to: toDateInput(now) };
  if (value === 'lastMonth') {
    return {
      from: toDateInput(new Date(year, month - 1, 1)),
      to: toDateInput(new Date(year, month, 0)),
    };
  }
  if (value === 'quarter') return { from: toDateInput(new Date(year, month - 2, 1)), to: toDateInput(now) };
  return { from: toDateInput(new Date(year, 0, 1)), to: toDateInput(now) };
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  fontSize: 11,
  stroke: 'hsl(var(--muted-foreground))',
} as const;

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  fontSize: 12,
  color: 'hsl(var(--foreground))',
} as const;

export default function AnalyticsPage() {
  const [range, setRange] = useState('quarter');
  const [customFrom, setCustomFrom] = useState(toDateInput(new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1)));
  const [customTo, setCustomTo] = useState(toDateInput(new Date()));
  const [groupId, setGroupId] = useState('all');
  const [reportMonth, setReportMonth] = useState(monthInput());
  const [downloading, setDownloading] = useState(false);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const yearFilters = useMemo(
    () => ({ from: `${year}-01-01`, to: `${year}-12-31` }),
    [year],
  );

  const { from, to } = rangeFor(range, customFrom, customTo);

  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (groupId !== 'all') params.groupId = groupId;
    return params;
  }, [from, to, groupId]);

  const monthlyQuery = useQuery({
    queryKey: ['analytics', 'monthly', filters],
    queryFn: async () => {
      const { data } = await api.get('/api/analytics/monthly', { params: filters });
      return data.months as MonthlyPoint[];
    },
  });
  const weeklyQuery = useQuery({
    queryKey: ['analytics', 'weekly', filters],
    queryFn: async () => {
      const { data } = await api.get('/api/analytics/weekly', { params: filters });
      return data.weeks as WeeklyPoint[];
    },
  });
  const categoriesQuery = useQuery({
    queryKey: ['analytics', 'categories', filters],
    queryFn: async () => {
      const { data } = await api.get('/api/analytics/categories', { params: filters });
      return data.categories as CategoryStat[];
    },
  });
  const membersQuery = useQuery({
    queryKey: ['analytics', 'members', filters],
    queryFn: async () => {
      const { data } = await api.get('/api/analytics/members', { params: filters });
      return data.members as MemberStat[];
    },
  });
  const groupsQuery = useQuery({
    queryKey: ['analytics', 'groups', filters],
    queryFn: async () => {
      const { data } = await api.get('/api/analytics/groups', { params: filters });
      return data.groups as GroupStat[];
    },
  });
  const groupsListQuery = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data } = await api.get('/api/groups');
      return data.groups as Group[];
    },
  });
  const yearMonthlyQuery = useQuery({
    queryKey: ['analytics', 'year-monthly', year],
    queryFn: async () => {
      const { data } = await api.get('/api/analytics/monthly', { params: yearFilters });
      return data.months as MonthlyPoint[];
    },
  });
  const yearDailyQuery = useQuery({
    queryKey: ['analytics', 'year-daily', year],
    queryFn: async () => {
      const { data } = await api.get('/api/analytics/daily', { params: yearFilters });
      return data.days as DailyPoint[];
    },
  });

  const months = monthlyQuery.data || [];
  const weeks = weeklyQuery.data || [];
  const categories = categoriesQuery.data || [];
  const members = membersQuery.data || [];
  const byGroup = groupsQuery.data || [];
  const totalPaise = categories.reduce((sum, row) => sum + row.totalPaise, 0);
  const mySharePaise = categories.reduce((sum, row) => sum + row.mySharePaise, 0);
  const count = categories.reduce((sum, row) => sum + row.count, 0);
  const topMember = members[0];
  const memberChart = members.slice(0, 8).map((row) => ({
    name: row.isCurrentUser ? `${row.name} (you)` : row.name.split(' ')[0],
    paidPaise: row.paidPaise,
    sharePaise: row.sharePaise,
    avatarColor: row.avatarColor,
  }));

  const yearMonths = yearMonthlyQuery.data || [];
  const yearDays = yearDailyQuery.data || [];
  const yearTotal = yearMonths.reduce((sum, row) => sum + row.totalPaise, 0);
  const yearMyShare = yearMonths.reduce((sum, row) => sum + row.mySharePaise, 0);
  const activeDays = yearDays.filter((day) => day.totalPaise > 0).length;
  const elapsedMonths = year === currentYear ? new Date().getMonth() + 1 : 12;
  const monthlyAverage = Math.round(yearTotal / Math.max(1, elapsedMonths));
  const maxDayPaise = Math.max(...yearDays.map((day) => day.totalPaise), 1);
  const dailyByDate = new Map(yearDays.map((day) => [day.date, day]));
  const bestMonth = [...yearMonths].sort((a, b) => b.totalPaise - a.totalPaise)[0];
  const yearOptions = Array.from({ length: 6 }, (_, index) => currentYear - index);

  const downloadReport = async () => {
    try {
      setDownloading(true);
      const response = await api.get(`/api/reports/monthly?month=${reportMonth}`, { responseType: 'blob' });
      downloadBlob(response.data, `splitmate-report-${reportMonth}.csv`);
      toast.success('Monthly report downloaded');
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Analytics"
        title="Spending intelligence"
        description="Trends, categories and member comparisons, calculated on the server from base-currency paise."
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button variant="outline" onClick={downloadReport} disabled={downloading}>
              <Download className="h-4 w-4" /> {downloading ? 'Preparing…' : 'Monthly CSV'}
            </Button>
          </>
        }
      />

      <Card className="no-print">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:p-5">
          <div className="sm:w-48">
            <Label>Date range</Label>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGES.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {range === 'custom' ? (
            <>
              <div>
                <Label htmlFor="from">From</Label>
                <Input id="from" type="date" className="mt-1.5" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="to">To</Label>
                <Input id="to" type="date" className="mt-1.5" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
              </div>
            </>
          ) : null}
          <div className="sm:w-52">
            <Label>Group</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups</SelectItem>
                {(groupsListQuery.data || []).map((group) => (
                  <SelectItem key={group._id} value={group._id}>
                    {group.emoji} {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:ml-auto">
            <Label>Report month</Label>
            <div className="mt-1.5 flex gap-2">
              <Input type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} className="w-40" />
              <Button variant="outline" onClick={downloadReport} disabled={downloading}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Filtered spend</p>
          <p className="mt-1 font-display text-2xl font-bold">{formatMoney(totalPaise, { compact: true })}</p>
          <p className="mt-1 text-xs text-muted-foreground">{count} expenses · {from} → {to}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your share</p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">{formatMoney(mySharePaise, { compact: true })}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {totalPaise ? Math.round((mySharePaise / totalPaise) * 100) : 0}% of filtered spend
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Top category</p>
          <p className="mt-1 font-display text-2xl font-bold">{categories[0]?.name || '—'}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {categories[0] ? formatMoney(categories[0].totalPaise, { compact: true }) : 'No data in range'}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Biggest spender</p>
          <p className="mt-1 font-display text-2xl font-bold">{topMember?.isCurrentUser ? 'You' : topMember?.name || '—'}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {topMember ? formatMoney(topMember.paidPaise, { compact: true }) : 'No data in range'}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" /> Year in spending
            </CardTitle>
            <CardDescription>Daily heatmap and twelve-month totals for your personal ledger.</CardDescription>
          </div>
          <div className="w-32 shrink-0">
            <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total spent</p>
              <p className="mt-1 font-display text-xl font-bold">{formatMoney(yearTotal, { compact: true })}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Your share</p>
              <p className="mt-1 font-display text-xl font-bold text-primary">{formatMoney(yearMyShare, { compact: true })}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Active days</p>
              <p className="mt-1 font-display text-xl font-bold">{activeDays}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Monthly average</p>
              <p className="mt-1 font-display text-xl font-bold">{formatMoney(monthlyAverage, { compact: true })}</p>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Daily activity</p>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  Less
                  {[0.15, 0.35, 0.55, 0.75, 1].map((alpha) => (
                    <span
                      key={alpha}
                      className="h-2.5 w-2.5 rounded-[2px]"
                      style={{ backgroundColor: `rgba(229, 9, 20, ${alpha})` }}
                    />
                  ))}
                  More
                </div>
              </div>
              {yearDailyQuery.isLoading ? (
                <Skeleton className="h-[240px] w-full" />
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[430px] space-y-1">
                    {MONTH_NAMES.map((monthLabel, monthIndex) => {
                      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
                      return (
                        <div key={monthLabel} className="flex items-center gap-2">
                          <span className="w-7 shrink-0 text-[10px] font-medium uppercase text-muted-foreground">
                            {monthLabel}
                          </span>
                          <div
                            className="grid flex-1 gap-[3px]"
                            style={{ gridTemplateColumns: 'repeat(31, minmax(0, 1fr))' }}
                          >
                            {Array.from({ length: 31 }, (_, dayIndex) => {
                              const day = dayIndex + 1;
                              if (day > daysInMonth) return <span key={day} className="aspect-square" />;
                              const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                              const entry = dailyByDate.get(key);
                              const intensity = entry?.totalPaise
                                ? 0.15 + (entry.totalPaise / maxDayPaise) * 0.85
                                : 0;
                              return (
                                <span
                                  key={day}
                                  title={`${monthLabel} ${day}: ${
                                    entry?.totalPaise
                                      ? `${formatMoney(entry.totalPaise)} · ${entry.count} expense${entry.count === 1 ? '' : 's'}`
                                      : 'No spend'
                                  }`}
                                  className="aspect-square rounded-[2px]"
                                  style={{
                                    backgroundColor: intensity
                                      ? `rgba(229, 9, 20, ${intensity})`
                                      : 'hsl(var(--muted))',
                                  }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                {activeDays} active day{activeDays === 1 ? '' : 's'} in {year}
                {bestMonth?.totalPaise
                  ? ` · biggest month ${bestMonth.label} (${formatMoney(bestMonth.totalPaise)})`
                  : ' · no spending recorded yet'}
              </p>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Monthly totals
              </p>
              {yearMonthlyQuery.isLoading ? (
                <Skeleton className="h-[240px] w-full" />
              ) : (
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearMonths} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" {...axisProps} tickMargin={8} tickFormatter={(value) => String(value).slice(0, 3)} />
                      <YAxis {...axisProps} width={58} tickFormatter={(value) => formatMoney(Number(value), { compact: true })} />
                      <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={tooltipStyle} />
                      <Bar dataKey="totalPaise" name="Spend" fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>Monthly trend</CardTitle>
            <CardDescription>Total spend and your share over time.</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyQuery.isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : months.length ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={months} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="analyticsTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" {...axisProps} tickMargin={8} />
                    <YAxis {...axisProps} width={62} tickFormatter={(value) => formatMoney(Number(value), { compact: true })} />
                    <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="totalPaise" name="Total" stroke="#6366f1" strokeWidth={2.5} fill="url(#analyticsTotal)" />
                    <Line type="monotone" dataKey="mySharePaise" name="Your share" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState icon={BarChart3} title="No data in this range" description="Try another date range or add expenses." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Category mix</CardTitle>
            <CardDescription>Filtered spend by category.</CardDescription>
          </CardHeader>
          <CardContent>
            {categoriesQuery.isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : categories.length ? (
              <>
                <div className="h-[190px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categories.slice(0, 8)} dataKey="totalPaise" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2} strokeWidth={0}>
                        {categories.slice(0, 8).map((entry, index) => (
                          <Cell key={entry.categoryId} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                  {categories.slice(0, 8).map((entry, index) => (
                    <div key={entry.categoryId} className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color || PIE_COLORS[index % PIE_COLORS.length] }} />
                      <span className="flex-1 truncate text-muted-foreground">{entry.name}</span>
                      <span className="font-semibold tabular-nums">{formatMoney(entry.totalPaise, { compact: true })}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">No categories in range.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Weekly spending</CardTitle>
            <CardDescription>Last weeks in the selected range.</CardDescription>
          </CardHeader>
          <CardContent>
            {weeklyQuery.isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : weeks.length ? (
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeks} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" {...axisProps} tickMargin={8} />
                    <YAxis {...axisProps} width={58} tickFormatter={(value) => formatMoney(Number(value), { compact: true })} />
                    <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={tooltipStyle} />
                    <Bar dataKey="totalPaise" name="Spend" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">No weekly data in range.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Member comparison</CardTitle>
            <CardDescription>Total paid vs their own share.</CardDescription>
          </CardHeader>
          <CardContent>
            {membersQuery.isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : memberChart.length ? (
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={memberChart} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" {...axisProps} tickFormatter={(value) => formatMoney(Number(value), { compact: true })} />
                    <YAxis type="category" dataKey="name" {...axisProps} width={76} />
                    <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="paidPaise" name="Paid" fill="#6366f1" radius={[0, 5, 5, 0]} barSize={9} />
                    <Bar dataKey="sharePaise" name="Share" fill="#10b981" radius={[0, 5, 5, 0]} barSize={9} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">No member data in range.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Group-wise spending</CardTitle>
            <CardDescription>Total expense amount by group in range.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {byGroup.length ? (
              byGroup.map((entry) => {
                const max = Math.max(...byGroup.map((row) => row.totalPaise), 1);
                return (
                  <div key={entry.groupId}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span>{entry.emoji}</span> {entry.name}
                        <Badge variant="outline">{entry.count}</Badge>
                      </span>
                      <span className="font-semibold tabular-nums">{formatMoney(entry.totalPaise)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-rose-500"
                        style={{ width: `${(entry.totalPaise / max) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No group spending in range.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-primary" /> Highest spending members
            </CardTitle>
            <CardDescription>Ranked by total paid in range.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {members.slice(0, 6).map((member, index) => (
              <div key={member.userId} className="flex items-center gap-3 rounded-xl border border-border/60 p-2.5">
                <span className="w-4 text-xs font-bold text-muted-foreground">{index + 1}</span>
                <Avatar name={member.name} color={member.avatarColor} src={member.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.name}
                    {member.isCurrentUser ? <span className="ml-1.5 text-[10px] font-bold uppercase text-primary">You</span> : null}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {member.count} expenses · share {formatMoney(member.sharePaise)}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{formatMoney(member.paidPaise)}</span>
              </div>
            ))}
            {!members.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No members in range.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Category detail
          </CardTitle>
          <CardDescription>Full breakdown for the selected range.</CardDescription>
        </CardHeader>
        <CardContent>
          {categories.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-semibold">Category</th>
                    <th className="py-2 px-3 text-right font-semibold">Expenses</th>
                    <th className="py-2 px-3 text-right font-semibold">Total</th>
                    <th className="py-2 px-3 text-right font-semibold">Your share</th>
                    <th className="py-2 pl-3 text-right font-semibold">% of spend</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((entry) => (
                    <tr key={entry.categoryId} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-3">
                        <span className="flex items-center gap-2 font-medium">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                          {entry.name}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">{entry.count}</td>
                      <td className="py-2.5 px-3 text-right font-semibold tabular-nums">{formatMoney(entry.totalPaise)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{formatMoney(entry.mySharePaise)}</td>
                      <td className="py-2.5 pl-3 text-right tabular-nums text-muted-foreground">
                        {totalPaise ? Math.round((entry.totalPaise / totalPaise) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No category data for this range.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
