import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck, WalletCards } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/auth';
import { api, apiError } from '@/lib/api';
import { PAYMENT_APPS } from '@/lib/payments';
import type { User } from '@/types';

interface TrackPaymentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrackPaymentsDialog({ open, onOpenChange }: TrackPaymentsDialogProps) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (enable: boolean) => {
      if (!user) throw new Error('You need to be signed in');
      const { data } = await api.put(`/api/users/${user._id}`, {
        trackPayments: enable,
        paymentPromptSeen: true,
      });
      return { updated: data.user as User, enable };
    },
    onSuccess: ({ updated, enable }) => {
      setUser(updated);
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      onOpenChange(false);
      if (enable) {
        toast.success('Payment tracking is on');
        navigate('/payments');
      } else {
        toast.success('You can turn tracking on any time from Payments');
      }
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const handleOpenChange = (next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (mutation.isPending) return;
    if (user && !user.paymentPromptSeen) {
      mutation.mutate(false);
      return;
    }
    onOpenChange(false);
  };

  const trackingOn = Boolean(user?.trackPayments);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-primary" /> Track all your payments
          </DialogTitle>
          <DialogDescription>
            Keep every payment in one place — not only the ones you split with friends.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_APPS.map((app) => (
              <span
                key={app.value}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
              >
                {app.short}
              </span>
            ))}
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground">Two honest ways to track.</p>
            <p className="mt-1">
              GPay, PhonePe and Slice don&apos;t share your transaction history with other apps. Forward your
              bank alert emails or SMS and SplitMate captures those payments automatically, or log one in
              seconds and optionally attach the screenshot.
            </p>
          </div>

          <div className="space-y-2">
            {[
              'Monthly and yearly totals across every app',
              'Filter by GPay, PhonePe, Slice, bank or cash',
              'Forward bank alert emails or SMS — from Settings',
              'Screenshots and receipts saved with each payment',
            ].map((item) => (
              <p key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> {item}
              </p>
            ))}
          </div>

          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            SplitMate never asks for your UPI PIN, bank login or payment-app password, and everything stays
            private to your account.
          </p>
        </div>

        <DialogFooter>
          {trackingOn ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  onOpenChange(false);
                  navigate('/payments');
                }}
              >
                Open payments <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => mutation.mutate(false)}
                disabled={mutation.isPending}
              >
                Not now
              </Button>
              <Button onClick={() => mutation.mutate(true)} disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <WalletCards className="h-4 w-4" />
                )}
                Turn on tracking
              </Button>
            </>
          )}
        </DialogFooter>

        <p className="text-start text-[10px] text-muted-foreground/70">
          <Badge variant="outline" className="mr-1 text-[9px]">No app sync</Badge>
          Payments are logged by you or parsed from forwarded bank emails; SplitMate never claims a bank
          verified them.
        </p>
      </DialogContent>
    </Dialog>
  );
}
