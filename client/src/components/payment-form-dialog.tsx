import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Receipt, Upload, X } from 'lucide-react';
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
import { api, apiError } from '@/lib/api';
import { PAYMENT_APPS, PAYMENT_CATEGORIES } from '@/lib/payments';
import { cn } from '@/lib/utils';
import type { PaymentApp } from '@/types';

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

interface PaymentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultApp?: PaymentApp;
}

export function PaymentFormDialog({ open, onOpenChange, defaultApp = 'GPAY' }: PaymentFormDialogProps) {
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<'OUT' | 'IN'>('OUT');
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [app, setApp] = useState<PaymentApp>(defaultApp);
  const [category, setCategory] = useState('Other');
  const [paidAt, setPaidAt] = useState(todayInput());
  const [note, setNote] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const receiptInput = useRef<HTMLInputElement>(null);
  const idempotencyKey = useRef(newIdempotencyKey());

  useEffect(() => {
    if (!open) return;
    setDirection('OUT');
    setPayee('');
    setAmount('');
    setApp(defaultApp);
    setCategory('Other');
    setPaidAt(todayInput());
    setNote('');
    setReceiptUrl('');
    idempotencyKey.current = newIdempotencyKey();
  }, [open, defaultApp]);

  const amountPaise = Math.round(Number(amount) * 100);
  const canSubmit =
    payee.trim().length > 0 && Number.isFinite(amountPaise) && amountPaise > 0 && !uploading;

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(
        '/api/payments',
        {
          payee: payee.trim(),
          amount: amountPaise / 100,
          app,
          direction,
          category,
          paidAt: new Date(`${paidAt}T12:00:00`).toISOString(),
          note: note.trim(),
          receiptUrl,
        },
        { headers: { 'Idempotency-Key': idempotencyKey.current } },
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment logged');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Log a payment
          </DialogTitle>
          <DialogDescription>
            Add any payment you made in GPay, PhonePe, Slice, Paytm, your bank or in cash. Only you can see
            this.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(['OUT', 'IN'] as const).map((value) => (
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
                {value === 'OUT' ? 'I paid' : 'I received'}
              </button>
            ))}
          </div>

          <div>
            <Label htmlFor="payment-payee">{direction === 'OUT' ? 'Paid to' : 'Received from'}</Label>
            <Input
              id="payment-payee"
              className="mt-1.5"
              placeholder={direction === 'OUT' ? 'Shop, person or biller' : 'Person or source'}
              value={payee}
              onChange={(event) => setPayee(event.target.value)}
              maxLength={120}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="payment-amount">Amount (₹)</Label>
              <Input
                id="payment-amount"
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
              <Label>Payment app</Label>
              <Select value={app} onValueChange={(value) => setApp(value as PaymentApp)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_APPS.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_CATEGORIES.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {entry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="payment-date">Date</Label>
              <Input
                id="payment-date"
                type="date"
                className="mt-1.5"
                value={paidAt}
                max={todayInput()}
                onChange={(event) => setPaidAt(event.target.value)}
              />
            </div>
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
            <Label htmlFor="payment-note">Note (optional)</Label>
            <Textarea
              id="payment-note"
              className="mt-1.5"
              rows={2}
              placeholder="Anything worth remembering"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
            />
          </div>

          <p className="rounded-xl bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Logged by you.</strong> SplitMate doesn&apos;t connect to your
            bank or payment app, so this is a personal record — not a verified transaction.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !canSubmit}>
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Save payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
