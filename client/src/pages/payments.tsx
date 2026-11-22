import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  Check,
  CircleDollarSign,
  CreditCard,
  Info,
  Landmark,
  Plus,
  Receipt,
  Smartphone,
  Trash2,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import {
  Bar as ChartBar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PaymentFormDialog } from '@/components/payment-form-dialog';
import { TrackPaymentsDialog } from '@/components/track-payments-dialog';
import { api, apiError } from '@/lib/api';
import { PAYMENT_APPS, paymentAppLabel } from '@/lib/payments';
import { formatMoney } from '@/lib/utils';
import type { Paginated, Payment, PaymentApp, PaymentSummary } from '@/types';

const APP_ICON: Record<PaymentApp, LucideIcon> = {
  GPAY: Smartphone,
  PHONEPE: Smartphone,
  SLICE: CreditCard,
  PAYTM: Smartphone,
  BANK: Landmark,
  CASH: Banknote,
  OTHER: CircleDollarSign,
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthRange(month: string) {
  const [year, value] = month.split('-').map(Number);
  return {
    from: new Date(year, value - 1, 1).toISOString(),
    to: new Date(year, value, 1).toISOString(),
  };
}

function monthLabel(month: string) {
  const [year, value] = month.split('-').map(Number);
  return `${MONTH_SHORT[value - 1]} ${year}`;
}

function formatDay(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [appFilter, setAppFilter] = useState<'ALL' | PaymentApp>('ALL');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'OUT' | 'IN'>('ALL');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const range = useMemo(() => monthRange(month), [month]);
  const year = Number(month.slice(0, 4));

  const summaryQuery = useQuery({
    queryKey: ['payments', 'summary', year],
    queryFn: async () => {
      const { data } = await api.get('/api/payments/summary', { params: { year } });
      return data as PaymentSummary;
    },
  });

  const paymentsQuery = useQuery({
    queryKey: ['payments', 'list', month, appFilter, directionFilter, page],
    queryFn: async () => {
      const { data } = await api.get('/api/payments', {
        params: {
          from: range.from,
          to: range.to,
          app: appFilter === 'ALL' ? undefined : appFilter,
          direction: directionFilter === 'ALL' ? undefined : directionFilter,
          page,
          limit: 30,
        },
      });
      return data as Paginated<Payment>;
    },
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/payments/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment removed');
      setDeleteId(null);
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.put(`/api/payments/${id}`, { needsReview: false });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment confirmed');
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const summary = summaryQuery.data;
  const monthBucket = summary?.months.find((entry) => entry.month === month);
  const topApp = summary?.byApp[0];
  const maxApp = Math.max(1, ...(summary?.byApp.map((entry) => entry.outPaise) || [0]));
  const payments = paymentsQuery.data?.items || [];
  const chartData = (summary?.months || []).map((entry) => ({
    ...entry,
    label: MONTH_SHORT[Number(entry.month.slice(5)) - 1],
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Personal money"
        title="All payments"
        description="Every payment in one monthly record — GPay, PhonePe, Slice, Paytm, bank or cash. Logged by you or captured from a forwarded bank email or SMS, private to your account."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Log a payment
          </Button>
        }
      />

      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <WalletCards className="h-4 w-4 text-primary" /> Track every payment app
            </p>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Payment apps don&apos;t expose your history. Log a payment in seconds, or forward bank alert
              emails or SMS from Settings and let SplitMate capture them automatically. Totals stay grouped
              by app and month.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {PAYMENT_APPS.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => {
                    setAppFilter(entry.value);
                    setPage(1);
                  }}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                    appFilter === entry.value
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {entry.short}
                </button>
              ))}
              {appFilter !== 'ALL' ? (
                <button
                  type="button"
                  onClick={() => {
                    setAppFilter('ALL');
                    setPage(1);
                  }}
                  className="rounded-full px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
          <Button variant="outline" onClick={() => setGuideOpen(true)} className="shrink-0">
            <Info className="h-4 w-4" /> How tracking works
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Spent · {monthLabel(month)}
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-rose-500">
            {formatMoney(monthBucket?.outPaise || 0)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{monthBucket?.count || 0} payments this month</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Spent · {year}
          </p>
          <p className="mt-1 font-display text-2xl font-bold">{formatMoney(summary?.totals.outPaise || 0)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatMoney(summary?.totals.inPaise || 0)} received
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Payments logged
          </p>
          <p className="mt-1 font-display text-2xl font-bold">{summary?.totals.count || 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">Across every app in {year}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Top app</p>
          <p className="mt-1 font-display text-2xl font-bold">
            {topApp ? paymentAppLabel(topApp.app) : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {topApp ? `${formatMoney(topApp.outPaise)} spent` : 'Log a payment to see this'}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Payments by month</CardTitle>
            <CardDescription>Money recorded as paid in {year}.</CardDescription>
          </CardHeader>
          <CardContent className="h-[240px] pt-2">
            {summary ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={54}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => formatMoney(Number(value), { compact: true })}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    formatter={(value) => [formatMoney(Number(value)), 'Spent']}
                  />
                  <ChartBar dataKey="outPaise" fill="#e50914" radius={[4, 4, 0, 0]} maxBarSize={34} />
                </RechartsBarChart>
              </ResponsiveContainer>
            ) : (
              <SkeletonRows rows={3} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>By app</CardTitle>
            <CardDescription>Where your {year} spending happened.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary?.byApp.length ? (
              summary.byApp.map((entry) => {
                const Icon = APP_ICON[entry.app];
                return (
                  <div key={entry.app} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold">{paymentAppLabel(entry.app)}</p>
                        <p className="text-xs font-semibold tabular-nums">{formatMoney(entry.outPaise)}</p>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(4, (entry.outPaise / maxApp) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No payments logged in {year} yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-end justify-between gap-3 pb-3">
          <div>
            <CardTitle>Payment history</CardTitle>
            <CardDescription>Filter by month, app or direction. Delete a mistake and re-log it.</CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="payment-month" className="text-[11px] text-muted-foreground">Month</Label>
              <Input
                id="payment-month"
                type="month"
                className="mt-1 w-[150px]"
                value={month}
                max={currentMonth()}
                onChange={(event) => {
                  if (event.target.value) {
                    setMonth(event.target.value);
                    setPage(1);
                  }
                }}
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Direction</Label>
              <Select
                value={directionFilter}
                onValueChange={(value) => {
                  setDirectionFilter(value as 'ALL' | 'OUT' | 'IN');
                  setPage(1);
                }}
              >
                <SelectTrigger className="mt-1 w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="OUT">Paid out</SelectItem>
                  <SelectItem value="IN">Received</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">App</Label>
              <Select
                value={appFilter}
                onValueChange={(value) => {
                  setAppFilter(value as 'ALL' | PaymentApp);
                  setPage(1);
                }}
              >
                <SelectTrigger className="mt-1 w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All apps</SelectItem>
                  {PAYMENT_APPS.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {paymentsQuery.isLoading ? (
            <SkeletonRows rows={5} />
          ) : payments.length ? (
            <div className="space-y-1.5">
              {payments.map((payment) => {
                const Icon = APP_ICON[payment.app];
                const incoming = payment.direction === 'IN';
                return (
                  <div
                    key={payment._id}
                    className="flex items-center gap-3 rounded-xl border border-border/60 p-3 transition hover:bg-accent/40"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        incoming ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{payment.payee}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                        <span>{paymentAppLabel(payment.app)}</span>
                        <span>·</span>
                        <span>{payment.category}</span>
                        <span>·</span>
                        <span>{formatDay(payment.paidAt)}</span>
                        {payment.receiptUrl ? (
                          <>
                            <span>·</span>
                            <a
                              href={payment.receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-medium hover:text-primary"
                            >
                              <Receipt className="h-3 w-3" /> Receipt
                            </a>
                          </>
                        ) : null}
                        {payment.source === 'EMAIL' || payment.source === 'SMS' ? (
                          <Badge
                            variant="outline"
                            className="border-primary/40 px-1.5 py-0 text-[9px] font-semibold text-primary"
                          >
                            Auto · {payment.source === 'SMS' ? 'SMS' : 'Email'}
                          </Badge>
                        ) : null}
                        {payment.needsReview ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 px-1.5 py-0 text-[9px] font-semibold text-amber-500"
                          >
                            Needs review
                          </Badge>
                        ) : null}
                      </div>
                      {payment.note ? (
                        <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground/80">{payment.note}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="text-right">
                        <p
                          className={`text-sm font-bold tabular-nums ${
                            incoming ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {incoming ? '+' : '−'}
                          {formatMoney(payment.amountPaise)}
                        </p>
                        <Badge variant="outline" className="mt-0.5 text-[9px]">
                          {incoming ? 'Received' : 'Paid'}
                        </Badge>
                      </div>
                      {payment.needsReview ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => confirmMutation.mutate(payment._id)}
                          disabled={confirmMutation.isPending && confirmMutation.variables === payment._id}
                          title="Confirm this auto-captured payment"
                          className="gap-1 px-2 text-[11px]"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Confirm
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(payment._id)}
                        title="Delete payment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={WalletCards}
              title="No payments this month"
              description="Log a GPay, PhonePe, Slice, bank or cash payment and it appears here with its receipt."
              action={<Button onClick={() => setFormOpen(true)}>Log first payment</Button>}
            />
          )}

          {paymentsQuery.data && paymentsQuery.data.pages > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {paymentsQuery.data.page} of {paymentsQuery.data.pages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= paymentsQuery.data.pages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}

          <p className="mt-4 rounded-xl bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Personal record only.</strong> SplitMate never reads your bank
            or UPI app history. Every payment here was logged by you or parsed from an email or SMS you
            forwarded, and stays private to your account.
          </p>
        </CardContent>
      </Card>

      <PaymentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultApp={appFilter === 'ALL' ? 'GPAY' : appFilter}
      />
      <TrackPaymentsDialog open={guideOpen} onOpenChange={setGuideOpen} />
      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete this payment?"
        description="It will be removed from your monthly and yearly totals. This cannot be undone."
        confirmLabel="Delete payment"
        destructive
        onConfirm={async () => {
          if (deleteId) await deleteMutation.mutateAsync(deleteId);
        }}
      />
    </div>
  );
}
