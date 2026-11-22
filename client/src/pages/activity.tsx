import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { History, Receipt, Scale, UsersRound } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { api } from '@/lib/api';
import { cn, formatDateTime, formatMoney, timeAgo } from '@/lib/utils';
import type { ActivityItem, Group, Paginated } from '@/types';

const ENTITY_LABELS: Record<string, string> = {
  expense: 'Expense',
  settlement: 'Payment',
  group: 'Group',
  member: 'Member',
  user: 'Profile',
  recurring: 'Recurring',
};

const ACTION_TONE: Record<string, string> = {
  EXPENSE_CREATED: 'bg-primary/10 text-primary',
  EXPENSE_UPDATED: 'bg-amber-500/10 text-amber-500',
  EXPENSE_DELETED: 'bg-rose-500/10 text-rose-500',
  SETTLEMENT_CREATED: 'bg-emerald-500/10 text-emerald-500',
  SETTLEMENT_REVERSED: 'bg-rose-500/10 text-rose-500',
  SETTLEMENT_UPDATED: 'bg-secondary text-foreground',
  GROUP_CREATED: 'bg-amber-500/10 text-amber-500',
  GROUP_DELETED: 'bg-rose-500/10 text-rose-500',
  MEMBER_ADDED: 'bg-primary/10 text-primary',
  MEMBER_REMOVED: 'bg-amber-500/10 text-amber-500',
  MEMBER_LEFT: 'bg-amber-500/10 text-amber-500',
  RECURRING_CREATED: 'bg-primary/10 text-primary',
};

export default function ActivityPage() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('all');
  const [groupId, setGroupId] = useState('all');

  const activityQuery = useQuery({
    queryKey: ['activity', 'page', page, entityType, groupId],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (entityType !== 'all') params.entityType = entityType;
      if (groupId !== 'all') params.groupId = groupId;
      const { data } = await api.get('/api/activity', { params });
      return data as Paginated<ActivityItem>;
    },
    placeholderData: keepPreviousData,
  });
  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data } = await api.get('/api/groups');
      return data.groups as Group[];
    },
  });

  const items = activityQuery.data?.items || [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="History"
        title="Activity"
        description="A tamper-evident timeline of expenses, groups, members and payments across everything you can see."
      />

      <Card>
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-end sm:p-5">
          <div className="sm:w-52">
            <Select
              value={entityType}
              onValueChange={(value) => {
                setEntityType(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All activity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All activity</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
                <SelectItem value="settlement">Payments</SelectItem>
                <SelectItem value="group">Groups</SelectItem>
                <SelectItem value="member">Members</SelectItem>
                <SelectItem value="recurring">Recurring</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:w-56">
            <Select
              value={groupId}
              onValueChange={(value) => {
                setGroupId(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups</SelectItem>
                {(groupsQuery.data || []).map((group) => (
                  <SelectItem key={group._id} value={group._id}>
                    {group.emoji} {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground sm:ml-auto">
            {entityType === 'all' ? 'Everything' : ENTITY_LABELS[entityType]}
            {groupId !== 'all' ? ' · group filtered' : ''}
          </p>
        </CardContent>
      </Card>

      {activityQuery.isLoading ? (
        <SkeletonRows rows={6} />
      ) : items.length ? (
        <Card>
          <CardContent className="p-2 sm:p-3">
            <div className="relative space-y-1">
              {items.map((item) => {
                const tone = ACTION_TONE[item.action] || 'bg-muted text-muted-foreground';
                const linkable = item.entityType === 'expense' && item.entityId;
                const body = (
                  <div className="flex items-start gap-3 rounded-xl px-2 py-3 transition hover:bg-accent/40">
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold', tone)}>
                      {item.entityType === 'settlement' ? '₹' : item.entityType === 'expense' ? 'EX' : item.entityType === 'member' ? 'MB' : item.entityType === 'group' ? 'GP' : 'RC'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Avatar name={item.actor?.name} color={item.actor?.avatarColor} src={item.actor?.avatarUrl} size="sm" className="h-5 w-5 text-[8px]" />
                        <p className="text-sm">{item.message}</p>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span>{formatDateTime(item.createdAt)}</span>
                        <span>·</span>
                        <span>{timeAgo(item.createdAt)}</span>
                        {item.group ? (
                          <>
                            <span>·</span>
                            <Link to={`/groups/${item.group._id}`} className="font-medium hover:text-primary">
                              {item.group.emoji} {item.group.name}
                            </Link>
                          </>
                        ) : null}
                        <Badge variant="outline" className="ml-1">
                          {ENTITY_LABELS[item.entityType] || item.entityType}
                        </Badge>
                      </div>
                    </div>
                    {item.amountPaise ? (
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(item.amountPaise)}</span>
                    ) : null}
                  </div>
                );
                return linkable ? (
                  <Link key={item._id} to={`/expenses/${item.entityId}`} className="block">
                    {body}
                  </Link>
                ) : (
                  <div key={item._id}>{body}</div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={History}
          title="No activity here"
          description="Try another filter, or start adding expenses and groups — every action is recorded."
        />
      )}

      {activityQuery.data && activityQuery.data.pages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {activityQuery.data.page} of {activityQuery.data.pages} · {activityQuery.data.total} entries
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= (activityQuery.data?.pages || 1)}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Receipt className="h-3 w-3" /> expenses</span>
          <span className="flex items-center gap-1"><Scale className="h-3 w-3" /> payments</span>
          <span className="flex items-center gap-1"><UsersRound className="h-3 w-3" /> groups</span>
        </div>
      )}
    </div>
  );
}
