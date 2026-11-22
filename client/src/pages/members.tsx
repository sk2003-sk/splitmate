import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HandCoins, Mail, Search, UserPlus, Users, UsersRound } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { AddMemberDialog } from '@/components/add-member-dialog';
import { SettleUpDialog } from '@/components/settle-up-dialog';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { cn, formatMoney } from '@/lib/utils';
import type { User } from '@/types';

interface MemberDetail {
  user: User;
  sharedGroups: { _id: string; name: string; emoji: string; memberCount: number }[];
  balancePaise: number;
}

export default function MembersPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [settleTarget, setSettleTarget] = useState<string | undefined>();
  const [settleOpen, setSettleOpen] = useState(false);

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/api/users');
      return data.users as User[];
    },
  });
  const detailQuery = useQuery({
    queryKey: ['users', detailId],
    queryFn: async () => {
      const { data } = await api.get(`/api/users/${detailId}`);
      return data as MemberDetail;
    },
    enabled: Boolean(detailId),
  });

  const users = usersQuery.data || [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (member) =>
        member.name.toLowerCase().includes(term) || member.email.toLowerCase().includes(term),
    );
  }, [users, search]);

  const openSettle = (targetId?: string) => {
    setDetailId(null);
    setSettleTarget(targetId);
    setSettleOpen(true);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="People"
        title="Members"
        description="Everyone in your SplitMate circle. Add friends, inspect shared groups and settle directly."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" /> Add member
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Members</p>
          <p className="mt-1 font-display text-2xl font-bold">{users.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">With accounts</p>
          <p className="mt-1 font-display text-2xl font-bold">{users.filter((member) => member.hasAccount).length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Invite-only profiles</p>
          <p className="mt-1 font-display text-2xl font-bold">{users.filter((member) => !member.hasAccount).length}</p>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Directory</CardTitle>
            <CardDescription>Click a member to see shared groups and your net balance.</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email…"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <SkeletonRows rows={5} />
          ) : filtered.length ? (
            <div className="grid gap-2 md:grid-cols-2">
              {filtered.map((member) => (
                <button
                  key={member._id}
                  type="button"
                  onClick={() => setDetailId(member._id)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border border-border/60 p-3 text-left transition hover:border-primary/30 hover:bg-accent/30',
                    member._id === user?._id && 'border-primary/30 bg-primary/[0.03]',
                  )}
                >
                  <Avatar name={member.name} color={member.avatarColor} src={member.avatarUrl} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                      {member.name}
                      {member._id === user?._id ? <span className="text-[10px] font-bold uppercase text-primary">You</span> : null}
                    </p>
                    <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      <Mail className="h-3 w-3 shrink-0" /> {member.email}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {member.isDemo ? <Badge variant="warning">Demo</Badge> : null}
                      {member.hasAccount ? <Badge variant="positive">Active</Badge> : <Badge variant="outline">Invite pending</Badge>}
                      {member.upiId ? <Badge variant="secondary">UPI</Badge> : null}
                    </div>
                  </div>
                  {member._id !== user?._id ? (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        openSettle(member._id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.stopPropagation();
                          openSettle(member._id);
                        }
                      }}
                      className="hidden shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary sm:flex"
                    >
                      <HandCoins className="h-3 w-3" /> Settle
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="No members match"
              description="Try a different search, or add someone new."
              action={<Button onClick={() => setAddOpen(true)}>Add member</Button>}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(detailId)} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Member profile</DialogTitle>
            <DialogDescription>Shared context and your current balance with this person.</DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading ? (
            <SkeletonRows rows={2} />
          ) : detailQuery.data ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar
                  name={detailQuery.data.user.name}
                  color={detailQuery.data.user.avatarColor}
                  src={detailQuery.data.user.avatarUrl}
                  size="xl"
                />
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-bold">{detailQuery.data.user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{detailQuery.data.user.email}</p>
                  {detailQuery.data.user.upiId ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">UPI · {detailQuery.data.user.upiId}</p>
                  ) : null}
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your balance</p>
                <p
                  className={cn(
                    'mt-0.5 font-display text-xl font-bold',
                    detailQuery.data.balancePaise > 0
                      ? 'text-emerald-500'
                      : detailQuery.data.balancePaise < 0
                        ? 'text-rose-500'
                        : 'text-foreground',
                  )}
                >
                  {formatMoney(detailQuery.data.balancePaise, { signed: true })}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {detailQuery.data.balancePaise > 0
                    ? 'They owe you'
                    : detailQuery.data.balancePaise < 0
                      ? 'You owe them'
                      : 'No outstanding balance'}
                </p>
              </div>
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                  <UsersRound className="h-3.5 w-3.5 text-primary" /> Shared groups
                </p>
                {detailQuery.data.sharedGroups.length ? (
                  <div className="space-y-1">
                    {detailQuery.data.sharedGroups.map((group) => (
                      <div key={group._id} className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2">
                        <span>{group.emoji}</span>
                        <span className="flex-1 truncate text-xs font-medium">{group.name}</span>
                        <span className="text-[10px] text-muted-foreground">{group.memberCount} members</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">You do not share a group with this person yet.</p>
                )}
              </div>
              {detailId !== user?._id ? (
                <Button className="w-full" onClick={() => openSettle(detailId || undefined)}>
                  <HandCoins className="h-4 w-4" /> Settle up
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Could not load this member.</p>
          )}
        </DialogContent>
      </Dialog>

      <AddMemberDialog open={addOpen} onOpenChange={setAddOpen} />
      <SettleUpDialog open={settleOpen} onOpenChange={setSettleOpen} defaultToUserId={settleTarget} />
    </div>
  );
}
