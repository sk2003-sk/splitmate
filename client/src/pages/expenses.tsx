import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Download,
  Filter,
  Plus,
  Receipt,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { ExpenseRow } from '@/components/expense-row';
import { api, apiError } from '@/lib/api';
import { downloadBlob, formatMoney } from '@/lib/utils';
import type { Category, Expense, Group, Paginated, User } from '@/types';

type ExpensePage = Paginated<Expense> & { totalPaise: number };

const SORTS = [
  { value: 'date', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount', label: 'Highest amount' },
  { value: 'amount-asc', label: 'Lowest amount' },
];

export default function ExpensesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const groupId = searchParams.get('groupId') || 'all';
  const categoryId = searchParams.get('categoryId') || 'all';
  const memberId = searchParams.get('memberId') || 'all';
  const sort = searchParams.get('sort') || 'date';
  const page = Number(searchParams.get('page') || 1);
  const [search, setSearch] = useState(q);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setSearch(q);
  }, [q]);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (!value || value === 'all' || value === 'date') next.delete(key);
      else next.set(key, value);
    });
    if (!('page' in patch)) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const filterParams = useMemo(() => {
    const params: Record<string, string> = { sort };
    if (q) params.q = q;
    if (groupId !== 'all') params.groupId = groupId;
    if (categoryId !== 'all') params.categoryId = categoryId;
    if (memberId !== 'all') params.memberId = memberId;
    return params;
  }, [q, groupId, categoryId, memberId, sort]);

  const expensesQuery = useQuery({
    queryKey: ['expenses', 'list', filterParams, page],
    queryFn: async () => {
      const { data } = await api.get('/api/expenses', {
        params: { ...filterParams, page, limit: 15 },
      });
      return data as ExpensePage;
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
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/api/categories');
      return data.categories as Category[];
    },
  });
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/api/users');
      return data.users as User[];
    },
  });

  const activeFilters = [q, groupId !== 'all', categoryId !== 'all', memberId !== 'all'].filter(Boolean).length;

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams(filterParams);
      const response = await api.get(`/api/expenses/export/csv?${params.toString()}`, {
        responseType: 'blob',
      });
      downloadBlob(response.data, `splitmate-expenses-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('Expense CSV downloaded');
    } catch (error) {
      toast.error(apiError(error));
    }
  };

  const expenses = expensesQuery.data?.items || [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Ledger"
        title="Expenses"
        description="Every shared purchase, searchable and filterable. The backend is the source of truth for all figures."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={() => navigate('/expenses/new')}>
              <Plus className="h-4 w-4" /> Add expense
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <form
              className="relative flex-1"
              onSubmit={(event) => {
                event.preventDefault();
                update({ q: search.trim() || null });
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search descriptions…"
                className="pl-9 pr-9"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    update({ q: null });
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </form>
            <div className="flex gap-2">
              <Select value={sort} onValueChange={(value) => update({ sort: value })}>
                <SelectTrigger className="w-full sm:w-[165px]">
                  <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORTS.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" className="sm:hidden" onClick={() => setShowFilters((value) => !value)}>
                <Filter className="h-4 w-4" /> Filters{activeFilters ? ` (${activeFilters})` : ''}
              </Button>
            </div>
          </div>

          <div className={`grid gap-2 sm:grid-cols-3 ${showFilters ? 'grid' : 'hidden sm:grid'}`}>
            <Select value={groupId} onValueChange={(value) => update({ groupId: value })}>
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
            <Select value={categoryId} onValueChange={(value) => update({ categoryId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(categoriesQuery.data || []).map((category) => (
                  <SelectItem key={category._id} value={category._id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={memberId} onValueChange={(value) => update({ memberId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Anyone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Anyone</SelectItem>
                {(usersQuery.data || []).map((member) => (
                  <SelectItem key={member._id} value={member._id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <span>
              {expensesQuery.data
                ? `${expensesQuery.data.total} expense${expensesQuery.data.total === 1 ? '' : 's'} · ${formatMoney(expensesQuery.data.totalPaise)}`
                : 'Loading expenses…'}
            </span>
            {activeFilters ? (
              <button
                type="button"
                className="flex items-center gap-1 font-semibold text-primary hover:underline"
                onClick={() => {
                  setSearch('');
                  setSearchParams(new URLSearchParams(), { replace: true });
                }}
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {expensesQuery.isLoading ? (
        <SkeletonRows rows={6} />
      ) : expenses.length ? (
        <>
          <Card>
            <CardContent className="divide-y divide-border/50 p-2 sm:p-3">
              {expenses.map((expense, index) => (
                <ExpenseRow key={expense._id} expense={expense} index={index} />
              ))}
            </CardContent>
          </Card>
          {expensesQuery.data && expensesQuery.data.pages > 1 ? (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {expensesQuery.data.page} of {expensesQuery.data.pages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => update({ page: String(page - 1) })}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= expensesQuery.data.pages}
                  onClick={() => update({ page: String(page + 1) })}
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
          title={activeFilters ? 'No matching expenses' : 'No expenses yet'}
          description={
            activeFilters
              ? 'Try clearing filters or searching for something else.'
              : 'Log your first shared purchase to start tracking balances.'
          }
          action={
            activeFilters ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setSearchParams(new URLSearchParams(), { replace: true });
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Link to="/expenses/new">
                <Button>
                  <Plus className="h-4 w-4" /> Add expense
                </Button>
              </Link>
            )
          }
        />
      )}
    </div>
  );
}
