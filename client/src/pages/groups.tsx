import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Plus, Receipt, UsersRound, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AvatarStack } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { CreateGroupDialog } from '@/components/create-group-dialog';
import { AddMemberDialog } from '@/components/add-member-dialog';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import type { Group } from '@/types';

export default function GroupsPage() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);

  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data } = await api.get('/api/groups');
      return data.groups as Group[];
    },
  });

  const groups = groupsQuery.data || [];
  const totalSpend = groups.reduce((sum, group) => sum + (group.totalPaise || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Groups"
        title="Your groups"
        description="Trips, homes, teams and one-off plans. Each group keeps its own expenses, balances and activity."
        actions={
          <>
            <Button variant="outline" onClick={() => setMemberOpen(true)}>
              <Plus className="h-4 w-4" /> Add member
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <UsersRound className="h-4 w-4" /> Create group
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Groups</p>
          <p className="mt-1 font-display text-2xl font-bold">{groups.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tracked spend</p>
          <p className="mt-1 font-display text-2xl font-bold">{formatMoney(totalSpend, { compact: true })}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Expenses</p>
          <p className="mt-1 font-display text-2xl font-bold">
            {groups.reduce((sum, group) => sum + (group.expenseCount || 0), 0)}
          </p>
        </Card>
      </div>

      {groupsQuery.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : groups.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <Link key={group._id} to={`/groups/${group._id}`} className="group block">
              <Card className="h-full transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lift">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/25 to-primary/5 text-2xl">
                      {group.emoji || '👥'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate">{group.name}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {group.description || 'No description yet.'}
                      </CardDescription>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-muted/50 p-2.5">
                      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <Wallet className="h-3 w-3" /> Total
                      </p>
                      <p className="mt-0.5 text-sm font-bold tabular-nums">
                        {formatMoney(group.totalPaise || 0, { compact: true })}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-2.5">
                      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <Receipt className="h-3 w-3" /> Expenses
                      </p>
                      <p className="mt-0.5 text-sm font-bold tabular-nums">{group.expenseCount || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <AvatarStack users={group.members} max={5} />
                    <Badge variant="outline">{group.memberCount || group.members.length} members</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={UsersRound}
          title="Start your first group"
          description="Group expenses by trip, flat or team so balances stay clear and settlements stay simple."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <UsersRound className="h-4 w-4" /> Create group
            </Button>
          }
        />
      )}

      <CreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(group) => navigate(`/groups/${group._id}`)}
      />
      <AddMemberDialog open={memberOpen} onOpenChange={setMemberOpen} />
    </div>
  );
}
