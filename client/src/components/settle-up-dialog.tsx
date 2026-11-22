import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  HandCoins,
  Loader2,
  Receipt,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/auth';
import { api, apiError } from '@/lib/api';
import { cn, formatMoney } from '@/lib/utils';
import type { BalancesResponse, Group, SettlementMethod, User } from '@/types';

const METHODS: { value: SettlementMethod; label: string }[] = [
  { value: 'UPI', label: 'UPI' },
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK', label: 'Bank transfer' },
  { value: 'OTHER', label: 'Other' },
];

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

interface SettleUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultToUserId?: string;
  defaultAmountPaise?: number;
  defaultGroupId?: string | null;
}

export function SettleUpDialog({
  open,
  onOpenChange,
  defaultToUserId,
  defaultAmountPaise,
  defaultGroupId,
}: SettleUpDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'details' | 'confirm'>('details');
  const [direction, setDirection] = useState<'pay' | 'receive'>('pay');
  const [otherUserId, setOtherUserId] = useState(defaultToUserId || '');
  const [amount, setAmount] = useState(defaultAmountPaise ? (defaultAmountPaise / 100).toFixed(2) : '');
  const [method, setMethod] = useState<SettlementMethod>('UPI');
  const [reference, setReference] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [note, setNote] = useState('');
  const [group, setGroup] = useState(defaultGroupId || 'none');
  const [confirmed, setConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const receiptInput = useRef<HTMLInputElement>(null);
  const idempotencyKey = useRef(newIdempotencyKey());

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/api/users');
      return data.users as User[];
    },
    enabled: open,
  });
  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data } = await api.get('/api/groups');
      return data.groups as Group[];
    },
    enabled: open,
  });
  const balancesQuery = useQuery({
    queryKey: ['balances'],
    queryFn: async () => {
      const { data } = await api.get('/api/balances');
      return data as BalancesResponse;
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setStep('details');
    setDirection('pay');
    setOtherUserId(defaultToUserId || '');
    setAmount(defaultAmountPaise ? (defaultAmountPaise / 100).toFixed(2) : '');
    setMethod('UPI');
    setReference('');
    setReceiptUrl('');
    setNote('');
    setGroup(defaultGroupId || 'none');
    setConfirmed(false);
    idempotencyKey.current = newIdempotencyKey();
  }, [open, defaultToUserId, defaultAmountPaise, defaultGroupId]);

  const users = usersQuery.data || [];
  const others = users.filter((candidate) => candidate._id !== user?._id);
  const other = users.find((candidate) => candidate._id === otherUserId);
  const groups = (groupsQuery.data || []).filter(
    (entry) =>
      !otherUserId ||
      (entry.members.some((member) => member._id === user?._id) &&
        entry.members.some((member) => member._id === otherUserId)),
  );

  const outstanding = useMemo(() => {
    if (!user || !otherUserId) return 0;
    const row = (balancesQuery.data?.pairwise || []).find(
      (entry) =>
        (entry.from._id === otherUserId && entry.to._id === user._id) ||
        (entry.from._id === user._id && entry.to._id === otherUserId),
    );
    if (!row) return 0;
    return row.from._id === otherUserId ? row.amountPaise : -row.amountPaise;
  }, [balancesQuery.data, otherUserId, user]);

  const suggested = direction === 'pay' ? Math.max(0, -outstanding) : Math.max(0, outstanding);

  useEffect(() => {
    if (!open || amount || !suggested) return;
    setAmount((suggested / 100).toFixed(2));
  }, [open, amount, suggested]);

  const amountPaise = Math.round(Number(amount) * 100);
  const amountValid = Number.isFinite(amountPaise) && amountPaise > 0;
  const methodLabel = METHODS.find((entry) => entry.value === method)?.label || method;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user || !otherUserId) throw new Error('Choose the other person');
      if (!amountValid) throw new Error('Enter a valid amount');
      if (!confirmed) throw new Error('Confirm that the payment happened');
      const fromUser = direction === 'pay' ? user._id : otherUserId;
      const toUser = direction === 'pay' ? otherUserId : user._id;
      const { data } = await api.post(
        '/api/settlements',
        {
          fromUser,
          toUser,
          group: group === 'none' ? null : group,
          amount: amountPaise / 100,
          method,
          reference: reference.trim(),
          receiptUrl,
          note: note.trim(),
        },
        { headers: { 'Idempotency-Key': idempotencyKey.current } },
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success('Payment recorded — balances updated');
      idempotencyKey.current = newIdempotencyKey();
      onOpenChange(false);
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const uploadReceipt = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      setUploading(true);
      const { data } = await api.post('/api/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setReceiptUrl(data.url);
      toast.success('Receipt attached');
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setUploading(false);
      if (receiptInput.current) receiptInput.current.value = '';
    }
  };

  const copyUpiId = async (upiId: string) => {
    try {
      await navigator.clipboard.writeText(upiId);
      toast.success('UPI ID copied');
    } catch {
      toast.error('Could not copy — copy it manually');
    }
  };

  const recipient = direction === 'pay' ? other : user;
  const upiLink =
    direction === 'pay' && method === 'UPI' && recipient?.upiId && amountValid
      ? `upi://pay?pa=${encodeURIComponent(recipient.upiId)}&pn=${encodeURIComponent(recipient.name)}&am=${encodeURIComponent((amountPaise / 100).toFixed(2))}&cu=INR&tn=${encodeURIComponent('SplitMate settlement')}`
      : null;

  const referenceLabel =
    method === 'UPI' ? 'UTR / transaction ID' : method === 'BANK' ? 'Transaction reference' : 'Reference';
  const referenceHint =
    method === 'UPI'
      ? 'Find the 12-digit UTR in your UPI app under payment history.'
      : method === 'BANK'
        ? 'NEFT, IMPS or cheque reference — helps you trace this later.'
        : 'Optional — anything that helps you find this payment later.';
  const referencePlaceholder =
    method === 'UPI' ? 'e.g. 402912345678' : method === 'BANK' ? 'e.g. NEFT reference' : 'Up to 120 characters';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-primary" /> Settle up
          </DialogTitle>
          <DialogDescription>
            {step === 'details'
              ? 'Choose who, how much and how. You can pay in your own UPI app, then confirm it here.'
              : 'Confirm the payment you made. SplitMate records your confirmation — it cannot verify it with your bank or UPI app.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
              step === 'details' ? 'bg-primary text-primary-foreground' : 'bg-primary/15 text-primary',
            )}
          >
            1
          </span>
          Details
          <span className="h-px flex-1 bg-border" />
          <span
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
              step === 'confirm' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            2
          </span>
          Confirm
        </div>

        {step === 'details' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(['pay', 'receive'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDirection(value)}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-sm font-semibold transition',
                    direction === value
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent',
                  )}
                >
                  {value === 'pay' ? 'I paid someone' : 'Someone paid me'}
                </button>
              ))}
            </div>

            <div>
              <Label>{direction === 'pay' ? 'Paid to' : 'Received from'}</Label>
              <Select
                value={otherUserId}
                onValueChange={(value) => {
                  setOtherUserId(value);
                  setGroup('none');
                  setAmount('');
                }}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Choose a member" />
                </SelectTrigger>
                <SelectContent>
                  {others.map((candidate) => (
                    <SelectItem key={candidate._id} value={candidate._id}>
                      {candidate.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {other ? (
              <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/40 p-3">
                <Avatar name={other.name} color={other.avatarColor} src={other.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{other.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {outstanding === 0
                      ? 'No outstanding balance'
                      : outstanding > 0
                        ? `${other.name} owes you ${formatMoney(outstanding)}`
                        : `You owe ${other.name} ${formatMoney(-outstanding)}`}
                  </p>
                </div>
                {suggested ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount((suggested / 100).toFixed(2))}
                  >
                    Use {formatMoney(suggested, { compact: true })}
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="settle-amount">Amount (₹)</Label>
                <Input
                  id="settle-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1.5 text-lg font-semibold"
                  placeholder="0.00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <div>
                <Label>Method</Label>
                <Select value={method} onValueChange={(value) => setMethod(value as SettlementMethod)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((entry) => (
                      <SelectItem key={entry.value} value={entry.value}>
                        {entry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Group context (optional)</Label>
              <Select value={group} onValueChange={setGroup}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="No specific group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific group</SelectItem>
                  {groups.map((entry) => (
                    <SelectItem key={entry._id} value={entry._id}>
                      {entry.emoji} {entry.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {direction === 'pay' && method === 'UPI' && recipient?.upiId ? (
              <div className="space-y-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {recipient ? (
                    <Avatar name={recipient.name} color={recipient.avatarColor} src={recipient.avatarUrl} size="sm" />
                  ) : null}
                  <span>
                    Pay <strong className="text-foreground">{recipient?.name}</strong> via UPI ·{' '}
                    <span className="font-mono text-[11px]">{recipient.upiId}</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {upiLink ? (
                    <a
                      href={upiLink}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
                    >
                      Open UPI app <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyUpiId(recipient.upiId as string)}
                  >
                    <ClipboardCopy className="h-3.5 w-3.5" /> Copy UPI ID
                  </Button>
                </div>
                {!upiLink ? (
                  <p className="text-[11px] text-muted-foreground">Enter an amount to enable the UPI link.</p>
                ) : null}
              </div>
            ) : null}

            {direction === 'pay' && method === 'UPI' && !recipient?.upiId ? (
              <p className="rounded-xl border border-border/70 bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
                {recipient?.name || 'This member'} hasn&apos;t added a UPI ID, so there is no one-tap link. Pay
                them in your own app, then continue and record the confirmation.
              </p>
            ) : null}

            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
              <Badge variant="outline" className="mt-0.5 shrink-0">
                Internal ledger
              </Badge>
              SplitMate never moves money. You pay in your own app; this records what you tell us happened.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/40 p-3">
              {other ? <Avatar name={other.name} color={other.avatarColor} src={other.avatarUrl} /> : null}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {direction === 'pay' ? `You paid ${other?.name || 'a member'}` : `${other?.name || 'A member'} paid you`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {methodLabel}
                  {group !== 'none' ? ` · ${groups.find((entry) => entry._id === group)?.name || 'Group'}` : ''}
                </p>
              </div>
              <p className="text-right font-display text-xl font-bold">
                {formatMoney(amountValid ? amountPaise : 0)}
              </p>
            </div>

            <div>
              <Label htmlFor="settle-ref">{referenceLabel}</Label>
              <Input
                id="settle-ref"
                className={cn('mt-1.5 font-mono', method === 'UPI' && 'text-base')}
                placeholder={referencePlaceholder}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                maxLength={120}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">{referenceHint}</p>
            </div>

            <div>
              <Label>Payment screenshot or receipt (optional)</Label>
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                <input
                  ref={receiptInput}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadReceipt(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => receiptInput.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {receiptUrl ? 'Replace file' : 'Upload file'}
                </Button>
                {receiptUrl ? (
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Receipt className="h-3.5 w-3.5" />
                    <a href={receiptUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                      View attachment
                    </a>
                    <button type="button" onClick={() => setReceiptUrl('')} aria-label="Remove receipt">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Image or PDF · up to 5 MB</span>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="settle-note">Note (optional)</Label>
              <Textarea
                id="settle-note"
                className="mt-1.5"
                rows={2}
                placeholder="Anything worth remembering"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
              />
            </div>

            <label
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed transition',
                confirmed ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border bg-card',
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-emerald-500"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>
                <strong className="text-foreground">
                  {direction === 'pay'
                    ? `I have paid ${other?.name || 'this person'} ${formatMoney(amountValid ? amountPaise : 0)}.`
                    : `I confirm ${other?.name || 'this person'} paid me ${formatMoney(amountValid ? amountPaise : 0)}.`}
                </strong>{' '}
                I understand SplitMate stores my confirmation and does not verify it with my bank or UPI app.
              </span>
            </label>

            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
              <Badge variant="outline" className="mt-0.5 shrink-0">
                User-confirmed
              </Badge>
              The other person sees this as recorded by you, not as a verified transfer.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'details' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => setStep('confirm')} disabled={!otherUserId || !amountValid}>
                {direction === 'pay' && method === 'UPI' && upiLink ? "I've paid — continue" : 'Continue'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('details')} disabled={mutation.isPending}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !confirmed || uploading}>
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Record payment
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
