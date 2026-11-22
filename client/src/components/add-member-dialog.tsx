import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, UserPlus } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, apiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'];

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (user: User) => void;
}

export function AddMemberDialog({ open, onOpenChange, onCreated }: AddMemberDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarColor, setAvatarColor] = useState(COLORS[0]);

  useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setAvatarColor(COLORS[0]);
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/users', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        avatarColor,
      });
      return data.user as User;
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`${created.name} added to SplitMate`);
      onOpenChange(false);
      onCreated?.(created);
    },
    onError: (error) => toast.error(apiError(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> Add a member
          </DialogTitle>
          <DialogDescription>
            Create a profile for a friend. They can claim it later by registering with the same
            email address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="member-name">Full name</Label>
            <Input
              id="member-name"
              className="mt-1.5"
              placeholder="Mounika"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="member-email">Email</Label>
            <Input
              id="member-email"
              type="email"
              className="mt-1.5"
              placeholder="mounika@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <Label>Avatar colour</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatarColor(color)}
                  className={cn(
                    'h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-card transition',
                    avatarColor === color ? 'ring-foreground/40' : 'ring-transparent',
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`Choose ${color}`}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || name.trim().length < 2 || !email.includes('@')}
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Add member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
