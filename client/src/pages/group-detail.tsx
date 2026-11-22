import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity as ActivityIcon,
  ArrowLeft,
  HandCoins,
  History,
  LogOut,
  Pencil,
  Plus,
  Receipt,
  Scale,
  Trash2,
  UserMinus,
  UserPlus,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarStack } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/primitives';
import { Skeleton, SkeletonCard, SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { ExpenseRow } from '@/components/expense-row';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { SettleUpDialog } from '@/components/settle-up-dialog';
import { useAuth } from '@/context/auth';
import { api, apiError } from '@/lib/api';
import { cn, formatMoney, person, timeAgo } from '@/lib/utils';
import type {
  ActivityItem,
  BalanceRow,
  Expense,
  Group,
  MemberStat,
  Paginated,
  User,
} from '@/types';

interface GroupDetailResponse {
  group: Group;
  balances: {
    summary: { youOwePaise: number; youAreOwedPaise: number; netPaise: number };
    pairwise: BalanceRow[];
    simplified: { from?: User; to?: User; amountPaise: number }[];
  };
  stats: { totalPaise: number; expenseCount: number };
}

const EMOJIS = ['👥', '🏖️', '🏠', '🎓', '💼', '🚗', '🎉', '✈️', '🎬', '🍕'];

export default function GroupDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('expenses');
  const [settleOpen, setSettleOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editEmoji, setEditEmoji] = useState('👥');
  const [removeTarget, setRemoveTarget] = useState<User | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [expensePage, setExpensePage] = useState(1);

  const detailQuery = useQuery({
    queryKey: ['groups', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/groups/${id}`);
      return data as GroupDetailResponse;
    },
    enabled: Boolean(id),
  });
  const expensesQuery = useQuery({
    queryKey: ['expenses', 'group', id, expensePage],
    queryFn: async () => {
      const { data } = await api.get('/api/expenses', {
        params: { groupId: id, page: expensePage, limit: 12 },
      });
      return data as Paginated<Expense> & { totalPaise: number };
    },
    enabled: Boolean(id),
  });
  const activityQuery = useQuery({
    queryKey: ['activity', 'group', id],
    queryFn: async () => {
      const { data } = await api.get('/api/activity', { params: { groupId: id, limit: 12 } });
      return data as Paginated<ActivityItem>;
    },
    enabled: Boolean(id),
  });
  const membersQuery = useQuery({
    queryKey: ['analytics', 'members', 'group', id],
    queryFn: async () => {
      const { data } = await api.get('/api/analytics/members', { params: { groupId: id } });
      return data.members as MemberStat[];
    },
    enabled: Boolean(id),
  });
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/api/users');
      return data.users as User[];
    },
    enabled: addOpen,
  });

  const detail = detailQuery.data;
  const group = detail?.group;
  const isCreator = Boolean(group && user && person(group.createdBy)._id === user._id);

  const invalidate = async () => {
    await queryClient.invalidateQueries();
  };

  const addMemberMutation = useMutation({
    mutationFn: async () => {
      if (!addUserId) throw new Error('Choose a member');
      await api.post(`/api/groups/${id}/members`, { userId: addUserId });
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Member added');
      setAddOpen(false);
      setAddUserId('');
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const removeMutation = useMutation({
    mutationFn: async (target: User) => {
      await api.delete(`/api/groups/${id}/members/${target._id}`);
      return target;
    },
    onSuccess: async (target) => {
      await invalidate();
      toast.success(`${target._id === user?._id ? 'You left the group' : `${target.name} removed`}`);
      setRemoveTarget(null);
      if (target._id === user?._id) navigate('/groups');
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/api/groups/${id}`, {
        name: editName.trim(),
        description: editDescription.trim(),
        emoji: editEmoji,
      });
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Group updated');
      setEditOpen(false);
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/groups/${id}?force=true`);
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Group deleted');
      navigate('/groups');
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const candidates = useMemo(() => {
    if (!group) return [];
    const memberIds = new Set(group.members.map((member) => member._id));
    return (usersQuery.data || []).filter((candidate) => !memberIds.has(candidate._id));
  }, [group, usersQuery.data]);

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (detailQuery.isError || !group) {
    return (
      <EmptyState
        icon={UsersRound}
        title="Group not found"
        description="You may not be a member of this group, or it was deleted."
        action={
          <Link to="/groups">
            <Button>Back to groups</Button>
          </Link>
        }
      />
    );
  }

  const balances = detail?.balances;
  const stats = detail?.stats;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Group"
        title={`${group.emoji || '👥'} ${group.name}`}
        description={group.description || 'A shared space for expenses, balances and activity.'}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button variant="outline" onClick={() => setSettleOpen(true)}>
              <Scale className="h-4 w-4" /> Settle up
            </Button>
            <Button onClick={() => navigate(`/expenses/new?groupId=${id}`)}>
              <Plus className="h-4 w-4" /> Add expense
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/25 to-primary/5 text-3xl">
            {group.emoji || '👥'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <AvatarStack users={group.members} max={6} />
              <span className="text-xs text-muted-foreground">{group.members.length} members</span>
              {isCreator ? <Badge variant="default">You created this group</Badge> : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Created {new Date(group.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditName(group.name);
                setEditDescription(group.description || '');
                setEditEmoji(group.emoji || '👥');
                setEditOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Add member
            </Button>
            {isCreator ? (
              <Button variant="ghost" size="sm" className="text-rose-600 dark:text-rose-400" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-rose-600 dark:text-rose-400"
                onClick={() => user && setRemoveTarget(user)}
              >
                <LogOut className="h-3.5 w-3.5" /> Leave
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Group spend" value={formatMoney(stats?.totalPaise || 0, { compact: true })} icon={Wallet} index={0} />
        <StatCard
          label="Your net"
          value={formatMoney(balances?.summary.netPaise || 0, { signed: true })}
          hint={balances?.summary.netPaise && balances.summary.netPaise > 0 ? 'Owed to you' : balances?.summary.netPaise && balances.summary.netPaise < 0 ? 'You owe' : 'Settled'}
          icon={Scale}
          tone={balances?.summary.netPaise && balances.summary.netPaise > 0 ? 'positive' : balances?.summary.netPaise && balances.summary.netPaise < 0 ? 'negative' : 'neutral'}
          index={1}
        />
        <StatCard label="Expenses" value={String(stats?.expenseCount || 0)} icon={Receipt} tone="neutral" index={2} />
        <StatCard label="Members" value={String(group.members.length)} icon={UsersRound} tone="warning" index={3} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Group expenses</CardTitle>
                <CardDescription>Everything logged against {group.name}.</CardDescription>
              </div>
              <Button size="sm" onClick={() => navigate(`/expenses/new?groupId=${id}`)}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </CardHeader>
            <CardContent className="pt-1">
              {expensesQuery.isLoading ? (
                <SkeletonRows rows={4} />
              ) : expensesQuery.data?.items.length ? (
                <>
                  <div className="divide-y divide-border/50">
                    {expensesQuery.data.items.map((expense, index) => (
                      <ExpenseRow key={expense._id} expense={expense} index={index} />
                    ))}
                  </div>
                  {expensesQuery.data.pages > 1 ? (
                    <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                      <p className="text-xs text-muted-foreground">
                        Page {expensesQuery.data.page} of {expensesQuery.data.pages} ·{' '}
                        {formatMoney(expensesQuery.data.totalPaise)}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={expensePage <= 1} onClick={() => setExpensePage((value) => value - 1)}>
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={expensePage >= expensesQuery.data.pages}
                          onClick={() => setExpensePage((value) => value + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <EmptyState
                  icon={Receipt}
                  title="No expenses in this group"
                  description="Add the first expense and SplitMate will calculate everyone's share."
                  action={
                    <Button size="sm" onClick={() => navigate(`/expenses/new?groupId=${id}`)}>
                      Add expense
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balances">
          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" /> Balances in this group
                </CardTitle>
                <CardDescription>Debtor → creditor after netting all group payments.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {balances?.pairwise.length ? (
                  balances.pairwise.map((row) => (
                    <div key={`${row.from._id}-${row.to._id}`} className="flex items-center gap-2 rounded-xl border border-border/60 p-2.5">
                      <Avatar name={row.from.name} color={row.from.avatarColor} src={row.from.avatarUrl} size="sm" />
                      <span className="text-xs font-medium">{row.from._id === user?._id ? 'You' : row.from.name}</span>
                      <span className="text-muted-foreground">→</span>
                      <Avatar name={row.to.name} color={row.to.avatarColor} src={row.to.avatarUrl} size="sm" />
                      <span className="flex-1 text-xs font-medium">{row.to._id === user?._id ? 'You' : row.to.name}</span>
                      <span className="text-sm font-semibold tabular-nums">{formatMoney(row.amountPaise)}</span>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">This group is fully settled.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Simplified transfers</CardTitle>
                <CardDescription>Fewer payments that still clear the group.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {balances?.simplified.length ? (
                  balances.simplified.map((transfer, index) => {
                    const from = transfer.from ? person(transfer.from) : null;
                    const to = transfer.to ? person(transfer.to) : null;
                    return (
                      <div key={index} className="flex items-center gap-2 rounded-xl border border-border/60 p-2.5">
                        <span className="text-xs font-medium">{from?._id === user?._id ? 'You' : from?.name}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="flex-1 text-xs font-medium">{to?._id === user?._id ? 'You' : to?.name}</span>
                        <span className="text-sm font-semibold tabular-nums">{formatMoney(transfer.amountPaise)}</span>
                      </div>
                    );
                  })
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">No transfers needed.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Members & spending</CardTitle>
                <CardDescription>Who is in this group and how much they have fronted.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                <UserPlus className="h-3.5 w-3.5" /> Add
              </Button>
            </CardHeader>
            <CardContent>
              {membersQuery.isLoading ? (
                <SkeletonRows rows={3} />
              ) : (
                <div className="space-y-1.5">
                  {group.members.map((member) => {
                    const stat = (membersQuery.data || []).find((row) => row.userId === member._id);
                    const creator = person(group.createdBy)._id === member._id;
                    return (
                      <div key={member._id} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
                        <Avatar name={member.name} color={member.avatarColor} src={member.avatarUrl} />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                            {member.name}
                            {member._id === user?._id ? <span className="text-[10px] font-bold uppercase text-primary">You</span> : null}
                            {creator ? <Badge variant="outline">Creator</Badge> : null}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">{member.email}</p>
                        </div>
                        <div className="hidden text-right sm:block">
                          <p className="text-xs font-semibold tabular-nums">{formatMoney(stat?.paidPaise || 0)}</p>
                          <p className="text-[10px] text-muted-foreground">paid</p>
                        </div>
                        {!creator && (isCreator || member._id === user?._id) ? (
                          <Button variant="ghost" size="icon-sm" title="Remove member" onClick={() => setRemoveTarget(member)}>
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> Group timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              {activityQuery.isLoading ? (
                <SkeletonRows rows={4} />
              ) : activityQuery.data?.items.length ? (
                <div className="space-y-1">
                  {activityQuery.data.items.map((item) => (
                    <div key={item._id} className="flex items-start gap-3 rounded-xl px-1.5 py-2.5">
                      <Avatar name={item.actor?.name} color={item.actor?.avatarColor} src={item.actor?.avatarUrl} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{item.message}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {timeAgo(item.createdAt)} · {item.action.replaceAll('_', ' ').toLowerCase()}
                        </p>
                      </div>
                      {item.amountPaise ? (
                        <span className="shrink-0 text-xs font-semibold tabular-nums">{formatMoney(item.amountPaise)}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SettleUpDialog open={settleOpen} onOpenChange={setSettleOpen} defaultGroupId={id} />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a member</DialogTitle>
            <DialogDescription>Pick an existing SplitMate member to invite into {group.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Member</Label>
            <Select value={addUserId} onValueChange={setAddUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a member" />
              </SelectTrigger>
              <SelectContent>
                {candidates.length ? (
                  candidates.map((candidate) => (
                    <SelectItem key={candidate._id} value={candidate._id}>
                      {candidate.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    Everyone is already in this group
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Need someone new? Add them from the Members page first.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => addMemberMutation.mutate()} disabled={!addUserId || addMemberMutation.isPending}>
              Add member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit group</DialogTitle>
            <DialogDescription>Update the name, icon or description.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <div>
                <Label>Icon</Label>
                <Select value={editEmoji} onValueChange={setEditEmoji}>
                  <SelectTrigger className="mt-1.5 w-20 justify-center px-2">
                    <span className="text-lg">{editEmoji}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {EMOJIS.map((emoji) => (
                      <SelectItem key={emoji} value={emoji}>
                        <span className="text-lg">{emoji}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label htmlFor="group-edit-name">Name</Label>
                <Input
                  id="group-edit-name"
                  className="mt-1.5"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="group-edit-description">Description</Label>
              <Textarea
                id="group-edit-description"
                className="mt-1.5"
                rows={3}
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
              />
            </div>
            <Separator />
            <p className="text-[11px] text-muted-foreground">
              Any member can edit group details. Only the creator can manage members or delete the
              group.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending || editName.trim().length < 2}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={removeTarget?._id === user?._id ? 'Leave this group?' : `Remove ${removeTarget?.name}?`}
        description={
          <span className={cn('block', 'text-sm')}>
            {removeTarget?._id === user?._id
              ? 'You can only leave when your balance in this group is settled.'
              : 'They can only be removed when they have no unsettled balance in this group.'}
          </span>
        }
        confirmLabel={removeTarget?._id === user?._id ? 'Leave group' : 'Remove member'}
        destructive
        onConfirm={async () => {
          if (removeTarget) await removeMutation.mutateAsync(removeTarget);
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete “${group.name}”?`}
        description="This permanently deletes the group, all of its expenses, settlements and recurring templates. Balances across the group disappear. This cannot be undone."
        confirmLabel="Delete group permanently"
        destructive
        onConfirm={() => deleteMutation.mutateAsync()}
      />
    </div>
  );
}
