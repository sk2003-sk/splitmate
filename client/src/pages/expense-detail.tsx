import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Pencil,
  Receipt,
  Scale,
  Trash2,
  UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/primitives';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { CategoryIcon } from '@/components/category-icon';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ExpenseForm } from '@/components/expense-form';
import { SettleUpDialog } from '@/components/settle-up-dialog';
import { useAuth } from '@/context/auth';
import { api, apiError } from '@/lib/api';
import { cn, formatDate, formatMoney, methodLabel, person } from '@/lib/utils';
import type { Expense } from '@/types';

export default function ExpenseDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);

  const expenseQuery = useQuery({
    queryKey: ['expenses', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/expenses/${id}`);
      return data.expense as Expense;
    },
    enabled: Boolean(id),
  });

  const expense = expenseQuery.data;
  const creator = expense ? person(expense.createdBy) : null;
  const canManage = Boolean(expense && user && creator?._id === user._id);
  const category = expense && typeof expense.category === 'object' ? expense.category : null;
  const group = expense && expense.group && typeof expense.group === 'object' ? expense.group : null;

  const myShare = useMemo(() => {
    if (!expense || !user) return 0;
    return expense.splits
      .filter((split) => person(split.user)._id === user._id)
      .reduce((sum, split) => sum + split.amountPaise, 0);
  }, [expense, user]);

  const iPaid = useMemo(() => {
    if (!expense || !user) return 0;
    return expense.paidBy
      .filter((payer) => person(payer.user)._id === user._id)
      .reduce((sum, payer) => sum + payer.amountPaise, 0);
  }, [expense, user]);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/expenses/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success('Expense deleted');
      navigate('/expenses');
    },
    onError: (error) => toast.error(apiError(error)),
  });

  if (expenseQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (expenseQuery.isError || !expense) {
    return (
      <EmptyState
        icon={Receipt}
        title="Expense not found"
        description="It may have been deleted, or you may not have access to it."
        action={
          <Link to="/expenses">
            <Button>Back to expenses</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Expense"
        title={expense.description}
        description={`Added by ${creator?.name || 'a member'} · ${formatDate(expense.date, 'long')}`}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button variant="outline" onClick={() => setSettleOpen(true)}>
              <Scale className="h-4 w-4" /> Settle up
            </Button>
            {canManage ? (
              <>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button variant="destructive" onClick={() => setDeleteOpen(true)} aria-label="Delete expense">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center gap-4">
            <CategoryIcon icon={category?.icon} color={category?.color} className="h-12 w-12" />
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate">{expense.description}</CardTitle>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {category ? <Badge variant="secondary">{category.name}</Badge> : null}
                {group ? (
                  <Link to={`/groups/${group._id}`}>
                    <Badge variant="secondary" className="hover:bg-primary/10 hover:text-primary">
                      {group.emoji} {group.name}
                    </Badge>
                  </Link>
                ) : (
                  <Badge variant="outline">Personal</Badge>
                )}
                <Badge variant="outline">{methodLabel(expense.splitMethod)}</Badge>
                {expense.currency !== 'INR' ? (
                  <Badge variant="warning">
                    {expense.currency} @ {expense.exchangeRate}
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-2xl font-bold tracking-tight">{formatMoney(expense.amountPaise)}</p>
              {expense.currency !== 'INR' ? (
                <p className="text-[11px] text-muted-foreground">≈ {formatMoney(expense.baseAmountPaise)}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">Your share {formatMoney(myShare)}</p>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" /> Date
                </p>
                <p className="mt-1 text-sm font-semibold">{formatDate(expense.date, 'long')}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Receipt className="h-3.5 w-3.5" /> Paid by
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  {expense.paidBy.map((payer) => {
                    const entry = person(payer.user);
                    return (
                      <span key={entry._id} className="flex items-center gap-1 text-sm font-semibold">
                        <Avatar name={entry.name} color={entry.avatarColor} src={entry.avatarUrl} size="sm" className="h-5 w-5 text-[8px]" />
                        {entry.name}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <UsersRound className="h-3.5 w-3.5" /> Split
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {methodLabel(expense.splitMethod)} · {expense.splits.length} people
                </p>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Who paid</h3>
                <span className="text-xs text-muted-foreground">
                  {iPaid > 0
                    ? `You paid ${formatMoney(iPaid)}`
                    : `${expense.paidBy.length} ${expense.paidBy.length === 1 ? 'payer' : 'payers'}`}
                </span>
              </div>
              <div className="space-y-1.5">
                {expense.paidBy.map((payer) => {
                  const entry = person(payer.user);
                  return (
                    <div key={entry._id} className="flex items-center gap-3 rounded-xl border border-border/60 p-2.5">
                      <Avatar name={entry.name} color={entry.avatarColor} src={entry.avatarUrl} size="sm" />
                      <span className="flex-1 truncate text-sm">{entry.name}</span>
                      <span className="text-sm font-semibold tabular-nums">{formatMoney(payer.amountPaise)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Shares</h3>
                {myShare > 0 ? (
                  <span className="text-xs font-semibold text-foreground">Your share {formatMoney(myShare)}</span>
                ) : null}
              </div>
              <div className="space-y-1.5">
                {expense.splits.map((split) => {
                  const entry = person(split.user);
                  return (
                    <div
                      key={entry._id}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border p-2.5',
                        entry._id === user?._id ? 'border-primary/30 bg-primary/[0.04]' : 'border-border/60',
                      )}
                    >
                      <Avatar name={entry.name} color={entry.avatarColor} src={entry.avatarUrl} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {entry.name}
                          {entry._id === user?._id ? <span className="ml-1.5 text-[10px] font-bold uppercase text-primary">You</span> : null}
                        </p>
                        {split.value != null && expense.splitMethod !== 'equal' ? (
                          <p className="text-[11px] text-muted-foreground">
                            {expense.splitMethod === 'percentage'
                              ? `${split.value}%`
                              : expense.splitMethod === 'shares'
                                ? `${split.value} share${Number(split.value) === 1 ? '' : 's'}`
                                : 'custom amount'}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{formatMoney(split.amountPaise)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {expense.notes ? (
              <div>
                <h3 className="mb-1.5 text-sm font-semibold">Notes</h3>
                <p className="whitespace-pre-wrap rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">
                  {expense.notes}
                </p>
              </div>
            ) : null}

            {expense.receiptUrl ? (
              <div>
                <h3 className="mb-1.5 text-sm font-semibold">Receipt</h3>
                <a
                  href={expense.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-primary transition hover:bg-accent"
                >
                  <FileText className="h-4 w-4" /> View attached receipt
                </a>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Balance impact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                <span className="text-xs text-muted-foreground">You paid</span>
                <span className="text-sm font-semibold">{formatMoney(iPaid)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                <span className="text-xs text-muted-foreground">Your share</span>
                <span className="text-sm font-semibold">{formatMoney(myShare)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Net for you</span>
                <span
                  className={cn(
                    'text-lg font-bold',
                    iPaid - myShare > 0 ? 'text-emerald-500' : iPaid - myShare < 0 ? 'text-rose-500' : 'text-foreground',
                  )}
                >
                  {formatMoney(iPaid - myShare, { signed: true })}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {iPaid - myShare > 0
                  ? 'You fronted more than your share — the group owes you the difference.'
                  : iPaid - myShare < 0
                    ? 'You owe the difference to whoever paid.'
                    : 'You paid exactly your share.'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Created by</span>
                <span className="font-medium">{creator?.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">{formatDate(expense.createdAt)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Last updated</span>
                <span className="font-medium">{formatDate(expense.updatedAt)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Currency</span>
                <span className="font-medium">
                  {expense.currency}
                  {expense.currency !== 'INR' ? ` · rate ${expense.exchangeRate}` : ''}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Expense ID</span>
                <span className="truncate font-mono text-[10px]">{expense._id}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>Edit expense</DialogTitle>
          <ExpenseForm
            expense={expense}
            compact
            onCancel={() => setEditing(false)}
            onSaved={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>

      <SettleUpDialog
        open={settleOpen}
        onOpenChange={setSettleOpen}
        defaultGroupId={group?._id}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this expense?"
        description="Balances and notifications will be recalculated immediately. This cannot be undone."
        confirmLabel="Delete expense"
        destructive
        onConfirm={() => deleteMutation.mutateAsync()}
      />
    </div>
  );
}
