import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { api, apiError } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';
import type { NotificationItem, Paginated } from '@/types';

type Inbox = Paginated<NotificationItem> & { unreadCount: number };

const TYPE_TONE: Record<string, string> = {
  EXPENSE_ADDED: 'bg-primary/10 text-primary',
  EXPENSE_UPDATED: 'bg-amber-500/10 text-amber-500',
  SETTLEMENT: 'bg-emerald-500/10 text-emerald-500',
  GROUP_INVITE: 'bg-amber-500/10 text-amber-500',
  MEMBER_ADDED: 'bg-primary/10 text-primary',
  SYSTEM: 'bg-secondary text-muted-foreground',
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const inboxQuery = useQuery({
    queryKey: ['notifications', 'inbox', page],
    queryFn: async () => {
      const { data } = await api.get('/api/notifications', { params: { page, limit: 20 } });
      return data as Inbox;
    },
  });

  const markOne = useMutation({
    mutationFn: async (item: NotificationItem) => {
      if (!item.read) await api.put(`/api/notifications/${item._id}/read`);
      return item;
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      if (item.link) navigate(item.link);
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const markAll = useMutation({
    mutationFn: async () => api.put('/api/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked read');
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const items = inboxQuery.data?.items || [];
  const unread = items.filter((item) => !item.read);
  const unreadCount = inboxQuery.data?.unreadCount || 0;

  const list = (rows: NotificationItem[]) =>
    rows.length ? (
      <div className="space-y-1">
        {rows.map((item) => (
          <button
            key={item._id}
            type="button"
            onClick={() => markOne.mutate(item)}
            className={cn(
              'flex w-full items-start gap-3 rounded-xl border border-transparent px-2.5 py-3 text-left transition hover:border-border hover:bg-accent/40',
              !item.read && 'bg-primary/[0.03]',
            )}
          >
            <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TYPE_TONE[item.type] || TYPE_TONE.SYSTEM)}>
              <Bell className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">{item.title}</span>
                {!item.read ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> : null}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{item.message}</span>
              <span className="mt-1 block text-[10px] uppercase tracking-wide text-muted-foreground/70">{timeAgo(item.createdAt)}</span>
            </span>
            {item.link ? <span className="shrink-0 self-center text-[11px] font-semibold text-primary">Open</span> : null}
          </button>
        ))}
      </div>
    ) : (
      <EmptyState
        icon={Bell}
        title="You're all caught up"
        description="Notifications about new expenses, payments and group invites will appear here."
      />
    );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Expense updates, member changes and recorded payments — with read state saved to your account."
        actions={
          <Button variant="outline" onClick={() => markAll.mutate()} disabled={!unreadCount || markAll.isPending}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Unread</p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">{unreadCount}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Loaded</p>
          <p className="mt-1 font-display text-2xl font-bold">{items.length}</p>
        </Card>
        <Card className="flex items-center gap-3 p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BellRing className="h-5 w-5" />
          </span>
          <p className="text-xs text-muted-foreground">
            New activity also appears in the bell menu so you never miss a change.
          </p>
        </Card>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread {unreadCount ? <Badge variant="default">{unreadCount}</Badge> : null}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <Card>
            <CardContent className="p-2 sm:p-3">
              {inboxQuery.isLoading ? <SkeletonRows rows={5} /> : list(items)}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="unread">
          <Card>
            <CardContent className="p-2 sm:p-3">
              {inboxQuery.isLoading ? <SkeletonRows rows={3} /> : list(unread)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {inboxQuery.data && inboxQuery.data.pages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {inboxQuery.data.page} of {inboxQuery.data.pages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= (inboxQuery.data?.pages || 1)}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
