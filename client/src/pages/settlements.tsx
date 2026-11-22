import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  Banknote,
  HandCoins,
  History,
  Paperclip,
  RotateCcw,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { SettleUpDialog } from '@/components/settle-up-dialog';
import { useAuth } from '@/context/auth';
import { api, apiError } from '@/lib/api';
import { cn, formatDate, formatDateTime, formatMoney, settlementMethodLabel } from '@/lib/utils';
import type { Paginated, Settlement } from '@/types';

const METHOD_ICON = {
  UPI: Smartphone,
  CASH: Banknote,
  BANK: Wallet,
  OTHER: HandCoins,
} as const;

export default function SettlementsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [recordOpen, setRecordOpen] = useState(false);
  const [reverseId, setReverseId] = useState<string | null>(null);

  const settlementsQuery = useQuery({
    queryKey: ['settlements', page],
    queryFn: async () => {
      const { data } = await api.get('/api/settlements', { params: { page, limit: 15 } });
      return data as Paginated<Settlement>;
    },
    placeholderData: keepPreviousData,
  });

  const reverseMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.put(`/api/settlements/${id}`, { status: 'REVERSED' });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success('Payment reversed — balances restored');
      setReverseId(null);
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const settlements = settlementsQuery.data?.items || [];
  const completed = settlements.filter((entry) => entry.status === 'COMPLETED');
  const incoming = completed.filter((entry) => entry.toUser?._id === user?._id);
  const outgoing = completed.filter((entry) => entry.fromUser?._id === user?._id);
  const totalIn = incoming.reduce((sum, entry) => sum + entry.amountPaise, 0);
  const totalOut = outgoing.reduce((sum, entry) => sum + entry.amountPaise, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Payments"
        title="Settlements"
        description="A complete record of payments users have logged. SplitMate tracks them internally — it never claims a transfer happened."
        actions={
          <Button onClick={() => setRecordOpen(true)}>
            <HandCoins className="h-4 w-4" /> Record payment
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Received</p>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-500">{formatMoney(totalIn)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{incoming.length} payments on this page</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Paid</p>
          <p className="mt-1 font-display text-2xl font-bold text-rose-500">{formatMoney(totalOut)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{outgoing.length} payments on this page</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total history</p>
          <p className="mt-1 font-display text-2xl font-bold">{settlementsQuery.data?.total || 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">Recorded settlements visible to you</p>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 pb-3">
          <div>
            <CardTitle>Payment history</CardTitle>
            <CardDescription>Reversing a payment restores both users&apos; balances and keeps an audit trail.</CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0">
            <History className="h-3 w-3" /> Audit kept
          </Badge>
        </CardHeader>
        <CardContent>
          {settlementsQuery.isLoading ? (
            <SkeletonRows rows={5} />
          ) : settlements.length ? (
            <div className="space-y-1.5">
              {settlements.map((entry) => {
                const from = entry.fromUser;
                const to = entry.toUser;
                const iPaid = from?._id === user?._id;
                const other = iPaid ? to : from;
                const MethodIcon = METHOD_ICON[entry.method] || HandCoins;
                const reversed = entry.status === 'REVERSED';
                return (
                  <div
                    key={entry._id}
                    className={cn(
                      'flex flex-col gap-3 rounded-xl border border-border/60 p-3 transition sm:flex-row sm:items-center',
                      reversed && 'opacity-60',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                        iPaid ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500',
                      )}
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {iPaid ? `You paid ${other?.name || 'a member'}` : `${other?.name || 'A member'} paid you`}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MethodIcon className="h-3 w-3" /> {settlementMethodLabel(entry.method)}
                        </span>
                        <span>·</span>
                        <span>{formatDateTime(entry.createdAt)}</span>
                        {entry.group ? (
                          <>
                            <span>·</span>
                            <Link to={`/groups/${entry.group._id}`} className="font-medium hover:text-primary">
                              {entry.group.emoji} {entry.group.name}
                            </Link>
                          </>
                        ) : null}
                        {entry.reference ? (
                          <>
                            <span>·</span>
                            <span className="font-mono text-[10px]">Ref {entry.reference}</span>
                          </>
                        ) : null}
                        {entry.receiptUrl ? (
                          <>
                            <span>·</span>
                            <a
                              href={entry.receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-medium hover:text-primary"
                            >
                              <Paperclip className="h-3 w-3" /> Receipt
                            </a>
                          </>
                        ) : null}
                      </div>
                      {entry.note ? <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground/80">{entry.note}</p> : null}
                    </div>
                    <div className="flex items-center gap-2 sm:shrink-0">
                      <div className="text-right">
                        <p className={cn('text-sm font-bold tabular-nums', iPaid ? 'text-rose-500' : 'text-emerald-500')}>
                          {iPaid ? '−' : '+'}
                          {formatMoney(entry.amountPaise)}
                        </p>
                        <Badge variant={reversed ? 'outline' : 'positive'} className="mt-0.5">
                          {reversed ? 'Reversed' : 'Completed'}
                        </Badge>
                      </div>
                      {!reversed ? (
                        <Button variant="ghost" size="sm" onClick={() => setReverseId(entry._id)} title="Reverse payment">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={HandCoins}
              title="No payments recorded yet"
              description="When you settle up with someone, the payment appears here with its method, reference and date."
              action={<Button onClick={() => setRecordOpen(true)}>Record first payment</Button>}
            />
          )}

          {settlementsQuery.data && settlementsQuery.data.pages > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {settlementsQuery.data.page} of {settlementsQuery.data.pages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= settlementsQuery.data.pages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}

          <p className="mt-4 rounded-xl bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Internal tracking only.</strong> Marking a payment as
            completed records it in the SplitMate ledger; no UPI, card or bank transfer is initiated
            here. Use the optional UPI link to pay in your own app, then record the reference.
          </p>
        </CardContent>
      </Card>

      <SettleUpDialog open={recordOpen} onOpenChange={setRecordOpen} />
      <ConfirmDialog
        open={Boolean(reverseId)}
        onOpenChange={(open) => !open && setReverseId(null)}
        title="Reverse this payment?"
        description="Both balances will be recalculated and the payment will stay in the audit history as reversed."
        confirmLabel="Reverse payment"
        destructive
        onConfirm={async () => {
          if (reverseId) await reverseMutation.mutateAsync(reverseId);
        }}
      />
    </div>
  );
}
