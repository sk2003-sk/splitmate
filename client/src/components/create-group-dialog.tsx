import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, UsersRound } from 'lucide-react';
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
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/context/auth';
import { api, apiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Group, User } from '@/types';

const EMOJIS = ['👥', '🏖️', '🏠', '🎓', '💼', '🚗', '🎉', '✈️', '🎬', '🍕'];

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (group: Group) => void;
}

export function CreateGroupDialog({ open, onOpenChange, onCreated }: CreateGroupDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('👥');
  const [description, setDescription] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/api/users');
      return data.users as User[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setName('');
    setEmoji('👥');
    setDescription('');
    setMemberIds(user ? [user._id] : []);
  }, [open, user]);

  const users = usersQuery.data || [];

  const toggleMember = (id: string) => {
    if (id === user?._id) return;
    setMemberIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (name.trim().length < 2) throw new Error('Give the group a name');
      const { data } = await api.post('/api/groups', {
        name: name.trim(),
        emoji,
        description: description.trim(),
        members: memberIds,
      });
      return data.group as Group;
    },
    onSuccess: async (group) => {
      await queryClient.invalidateQueries();
      toast.success(`“${group.name}” created`);
      onOpenChange(false);
      onCreated?.(group);
    },
    onError: (error) => toast.error(apiError(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UsersRound className="h-5 w-5 text-primary" /> Create a group
          </DialogTitle>
          <DialogDescription>
            Groups keep trips, housemates and shared projects organised. You can add or remove
            members any time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-16">
              <Label>Icon</Label>
              <div className="mt-1.5 flex h-10 items-center justify-center rounded-xl border border-input bg-card text-xl">
                {emoji}
              </div>
            </div>
            <div className="flex-1">
              <Label htmlFor="group-name">Group name</Label>
              <Input
                id="group-name"
                className="mt-1.5"
                placeholder="Trip to Goa"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setEmoji(value)}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition',
                  emoji === value
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-border bg-card hover:bg-accent',
                )}
              >
                {value}
              </button>
            ))}
          </div>

          <div>
            <Label htmlFor="group-description">Description (optional)</Label>
            <Textarea
              id="group-description"
              className="mt-1.5"
              rows={2}
              placeholder="What is this group for?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div>
            <Label>Members</Label>
            <div className="mt-1.5 max-h-56 divide-y divide-border/60 overflow-y-auto rounded-xl border border-border/70">
              {users.map((member) => {
                const selected = memberIds.includes(member._id);
                const isSelf = member._id === user?._id;
                return (
                  <button
                    key={member._id}
                    type="button"
                    onClick={() => toggleMember(member._id)}
                    disabled={isSelf}
                    className={cn(
                      'flex w-full items-center gap-3 p-2.5 text-left transition',
                      selected ? 'bg-primary/[0.04]' : 'hover:bg-accent',
                      isSelf && 'cursor-default',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition',
                        selected
                          ? 'border-primary bg-primary text-white'
                          : 'border-border bg-card text-transparent',
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                    <Avatar name={member.name} color={member.avatarColor} src={member.avatarUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{member.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {isSelf ? 'You · group creator' : member.email}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {memberIds.length} member{memberIds.length === 1 ? '' : 's'} selected
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || name.trim().length < 2}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
