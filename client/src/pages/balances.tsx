import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  HandCoins,
  Info,
  Scale,
  UsersRound,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/primitives';
import { SkeletonCard, SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { SettleUpDialog } from '@/components/settle-up-dialog';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { cn, formatDate, formatMoney, person } from '@/lib/utils';
import type { BalancesResponse, Category, BalanceRow, GroupRef, User } from '@/types';

interface BreakdownEntry {
  type: 'expense' | 'settlement';
  id: string;
  date: string;
  title: string;
  group?: GroupRef | null;
  category?: Category | null;
  amountPaise: number;
}

interface BreakdownResponse {
  user: User;
  balancePaise: number;
  breakdown: BreakdownEntry[];
}

export default function BalancesPage() {
  const { user } = useAuth();
  const [settleTarget, setSettleTarget] = useState<string | undefined>();
  const [settleAmount, setSettleAmount] = useState<number | undefined>();
  const [settleOpen, setSettleOpen] = useState(false);
  const [breakdownId, setBreakdownId] = useState<string | null>(null);

  const balancesQuery = useQuery({
    queryKey: ['balances'],
    queryFn: async () => {
      const { data } = await api.get('/api/balances');
      return data as BalancesResponse;
    },
  });

  const breakdownQuery = useQuery({
    queryKey: ['balances', 'breakdown', breakdownId],
    queryFn: async () => {
      const { data } = await api.get(`/api/balances/${breakdownId}`);
      return data as BreakdownResponse;
    },
    enabled: Boolean(breakdownId),
  });

  const openSettle = (otherId?: string, amount?: number) => {
    setSettleTarget(otherId);
    setSettleAmount(amount);
    setSettleOpen(true);
  };

  const balances = balancesQuery.data;
  const pairwise = balances?.pairwise || [];
  const simplified = balances?.simplified || [];

  const describeRole = (row: BalanceRow) => {
    if (!user) return '';
    if (row.from._id === user._id) return 'you-owe';
    if (row.to._id === user._id) return 'owes-you';
    return 'other';
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Balances"
        title="Who owes whom"
        description="Every figure comes from the backend ledger — expenses allocated across payers, netted with recorded payments."
        actions={
          <Button onClick={() => openSettle()}>
            <HandCoins className="h-4 w-4" /> Settle up
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {balancesQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, index) => <SkeletonCard key={index} />)
        ) : (
          <>
            <StatCard
              label="You owe"
              value={formatMoney(balances?.summary.youOwePaise || 0)}
              hint="Across all shared groups"
              icon={ArrowUpRight}
              tone="negative"
            />
            <StatCard
              label="You are owed"
              value={formatMoney(balances?.summary.youAreOwedPaise || 0)}
              hint="People who need to pay you"
              icon={ArrowDownLeft}
              tone="positive"
            />
            <StatCard
              label="Net position"
              value={formatMoney(balances?.summary.netPaise || 0, { signed: true })}
              hint={balances?.summary.netPaise && balances.summary.netPaise > 0 ? 'In your favour' : balances?.summary.netPaise && balances.summary.netPaise < 0 ? 'You are behind' : 'Fully settled'}
              icon={Scale}
              tone={balances?.summary.netPaise && balances.summary.netPaise > 0 ? 'positive' : balances?.summary.netPaise && balances.summary.netPaise < 0 ? 'negative' : 'neutral'}
            />
          </>
        )}
      </div>

      <Tabs defaultValue="people">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="simplified">Simplified debts</TabsTrigger>
          <TabsTrigger value="groups">By group</TabsTrigger>
        </TabsList>

        <TabsContent value="people">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Individual balances</CardTitle>
              <CardDescription>
                Click anyone to see the exact expenses and payments behind the number.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {balancesQuery.isLoading ? (
                <SkeletonRows rows={4} />
              ) : pairwise.length ? (
                <div className="space-y-1.5">
                  {pairwise.map((row) => {
                    const role = describeRole(row);
                    const other = role === 'you-owe' ? row.to : role === 'owes-you' ? row.from : row.to;
                    return (
                      <div
                        key={`${row.from._id}-${row.to._id}`}
                        className="flex flex-col gap-2 rounded-xl border border-border/60 p-3 transition hover:border-border hover:bg-accent/30 sm:flex-row sm:items-center"
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          onClick={() => setBreakdownId(other._id)}
                        >
                          <Avatar name={other.name} color={other.avatarColor} src={other.avatarUrl} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {role === 'you-owe' ? `You → ${other.name}` : role === 'owes-you' ? `${other.name} → You` : `${row.from.name} → ${row.to.name}`}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {role === 'you-owe'
                                ? 'You owe this person'
                                : role === 'owes-you'
                                  ? 'This person owes you'
                                  : 'Balance between other members'}
                            </p>
                          </div>
                        </button>
                        <div className="flex items-center gap-2 sm:shrink-0">
                          <span
                            className={cn(
                              'rounded-full px-2.5 py-1 text-sm font-bold tabular-nums',
                              role === 'you-owe'
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                : role === 'owes-you'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {formatMoney(row.amountPaise)}
                          </span>
                          {role !== 'other' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openSettle(other._id, row.amountPaise)}
                            >
                              Settle
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={Scale}
                  title="Everything is settled"
                  description="No outstanding balances between you and your groups. Nice."
                  action={
                    <Link to="/expenses/new">
                      <Button variant="outline">Add an expense</Button>
                    </Link>
                  }
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simplified">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-primary" /> Simplified debts
              </CardTitle>
              <CardDescription>
                A greedy netting pass that produces fewer transfers while clearing every balance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {balancesQuery.isLoading ? (
                <SkeletonRows rows={3} />
              ) : simplified.length ? (
                <div className="space-y-1.5">
                  {simplified.map((transfer, index) => {
                    const from = transfer.from ? person(transfer.from) : null;
                    const to = transfer.to ? person(transfer.to) : null;
                    const involvesMe = from?._id === user?._id || to?._id === user?._id;
                    return (
                      <div
                        key={`${from?._id}-${to?._id}-${index}`}
                        className="flex flex-col gap-2 rounded-xl border border-border/60 p-3 sm:flex-row sm:items-center"
                      >
                        <div className="flex flex-1 items-center gap-2">
                          {from ? <Avatar name={from.name} color={from.avatarColor} src={from.avatarUrl} size="sm" /> : null}
                          <span className="text-sm font-semibold">{from?._id === user?._id ? 'You' : from?.name}</span>
                          <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
                          {to ? <Avatar name={to.name} color={to.avatarColor} src={to.avatarUrl} size="sm" /> : null}
                          <span className="text-sm font-semibold">{to?._id === user?._id ? 'You' : to?.name}</span>
                        </div>
                        <div className="flex items-center gap-2 sm:shrink-0">
                          <span className="text-sm font-bold tabular-nums">{formatMoney(transfer.amountPaise)}</span>
                          {involvesMe ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openSettle((from?._id === user?._id ? to?._id : from?._id) || undefined, transfer.amountPaise)}
                            >
                              Settle
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">No transfers needed — you are all square.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups">
          <div className="grid gap-3 md:grid-cols-2">
            {balancesQuery.isLoading ? (
              Array.from({ length: 2 }).map((_, index) => <SkeletonCard key={index} />)
            ) : balances?.groupBalances.length ? (
              balances.groupBalances.map((entry) => (
                <Card key={entry.group._id}>
                  <CardHeader className="flex-row items-start justify-between pb-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <span className="text-lg">{entry.group.emoji}</span> {entry.group.name}
                      </CardTitle>
                      <CardDescription>
                        {entry.netPaise === 0
                          ? 'Settled within this group'
                          : entry.netPaise > 0
                            ? `You are owed ${formatMoney(entry.netPaise)}`
                            : `You owe ${formatMoney(-entry.netPaise)}`}
                      </CardDescription>
                    </div>
                    <Link to={`/groups/${entry.group._id}`}>
                      <Button variant="ghost" size="sm">
                        <UsersRound className="h-3.5 w-3.5" /> Open
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {entry.pairwise.length ? (
                      entry.pairwise.slice(0, 4).map((row) => {
                        const role = describeRole(row);
                        const other = role === 'you-owe' ? row.to : role === 'owes-you' ? row.from : row.to;
                        return (
                          <div key={`${row.from._id}-${row.to._id}`} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5">
                            <Avatar name={other.name} color={other.avatarColor} src={other.avatarUrl} size="sm" className="h-6 w-6 text-[9px]" />
                            <span className="flex-1 truncate text-xs">
                              {role === 'you-owe' ? `You owe ${other.name}` : role === 'owes-you' ? `${other.name} owes you` : `${row.from.name} owes ${row.to.name}`}
                            </span>
                            <span
                              className={cn(
                                'text-xs font-semibold tabular-nums',
                                role === 'you-owe' ? 'text-rose-500' : role === 'owes-you' ? 'text-emerald-500' : 'text-muted-foreground',
                              )}
                            >
                              {formatMoney(row.amountPaise)}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="py-3 text-center text-xs text-muted-foreground">No balances in this group.</p>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <EmptyState
                icon={UsersRound}
                title="No groups yet"
                description="Create a group to organise balances by trip, home or team."
                action={
                  <Link to="/groups">
                    <Button>View groups</Button>
                  </Link>
                }
                className="md:col-span-2"
              />
            )}
          </div>
        </TabsContent>
      </Tabs>

      <SettleUpDialog
        open={settleOpen}
        onOpenChange={setSettleOpen}
        defaultToUserId={settleTarget}
        defaultAmountPaise={settleAmount}
      />

      <Dialog open={Boolean(breakdownId)} onOpenChange={(open) => !open && setBreakdownId(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" /> How this balance was calculated
            </DialogTitle>
            <DialogDescription>
              Expenses and payments between you and this member, newest first.
            </DialogDescription>
          </DialogHeader>

          {breakdownQuery.isLoading ? (
            <SkeletonRows rows={4} />
          ) : breakdownQuery.data ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-3">
                <Avatar
                  name={breakdownQuery.data.user.name}
                  color={breakdownQuery.data.user.avatarColor}
                  src={breakdownQuery.data.user.avatarUrl}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{breakdownQuery.data.user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{breakdownQuery.data.user.email}</p>
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      'text-lg font-bold',
                      breakdownQuery.data.balancePaise > 0
                        ? 'text-emerald-500'
                        : breakdownQuery.data.balancePaise < 0
                          ? 'text-rose-500'
                          : 'text-foreground',
                    )}
                  >
                    {formatMoney(breakdownQuery.data.balancePaise, { signed: true })}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {breakdownQuery.data.balancePaise > 0 ? 'owes you' : breakdownQuery.data.balancePaise < 0 ? 'you owe' : 'settled'}
                  </p>
                </div>
              </div>

              <Separator />

              {breakdownQuery.data.breakdown.length ? (
                <div className="max-h-[380px] space-y-1 overflow-y-auto pr-1">
                  {breakdownQuery.data.breakdown.map((entry) => (
                    <div key={`${entry.type}-${entry.id}`} className="flex items-start gap-3 rounded-xl border border-border/60 p-2.5">
                      <span
                        className={cn(
                          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold',
                          entry.type === 'settlement'
                            ? 'bg-sky-500/10 text-sky-500'
                            : entry.amountPaise > 0
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-rose-500/10 text-rose-500',
                        )}
                      >
                        {entry.type === 'settlement' ? '₹' : (entry.category?.name || 'EX').slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{entry.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDate(entry.date)}
                          {entry.group ? ` · ${entry.group.emoji} ${entry.group.name}` : ''}
                          {entry.type === 'settlement' ? ' · payment' : ''}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 text-sm font-semibold tabular-nums',
                          entry.amountPaise > 0 ? 'text-emerald-500' : entry.amountPaise < 0 ? 'text-rose-500' : 'text-muted-foreground',
                        )}
                      >
                        {formatMoney(entry.amountPaise, { signed: true })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No direct transactions between you two.
                </p>
              )}

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    const target = breakdownId || undefined;
                    setBreakdownId(null);
                    openSettle(target);
                  }}
                >
                  <HandCoins className="h-4 w-4" /> Settle with {breakdownQuery.data.user.name}
                </Button>
              </div>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Could not load the breakdown.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
