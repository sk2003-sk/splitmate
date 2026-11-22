import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Plus, Receipt, Upload, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/primitives';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CategoryIcon } from '@/components/category-icon';
import { useAuth } from '@/context/auth';
import { api, apiError } from '@/lib/api';
import { cn, formatMoney, person, todayInput } from '@/lib/utils';
import { allocatePaise, previewSplits } from '@/lib/split';
import type { Category, Expense, Group, SplitMethod, User } from '@/types';

const schema = z.object({
  description: z.string().trim().min(1, 'Add a short description').max(160),
  amount: z.coerce.number().positive('Enter an amount greater than zero'),
  date: z.string().min(1, 'Pick a date'),
  categoryId: z.string().min(1, 'Choose a category'),
  groupId: z.string(),
  notes: z.string().max(1000),
  currency: z.string().min(3),
  exchangeRate: z.coerce.number().positive('Exchange rate must be positive'),
  receiptUrl: z.string(),
});

type FormValues = z.infer<typeof schema>;

const METHODS: { value: SplitMethod; label: string }[] = [
  { value: 'equal', label: 'Equally' },
  { value: 'exact', label: 'Exact' },
  { value: 'percentage', label: '%' },
  { value: 'shares', label: 'Shares' },
  { value: 'unequal', label: 'Custom' },
];

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];

interface ExpenseFormProps {
  expense?: Expense;
  defaultGroupId?: string | null;
  onSaved?: (expense: Expense) => void;
  onCancel?: () => void;
  compact?: boolean;
}

export function ExpenseForm({ expense, defaultGroupId, onSaved, onCancel, compact }: ExpenseFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const idempotencyKey = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
  );
  const receiptInput = useRef<HTMLInputElement>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(expense?.splitMethod || 'equal');
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});
  const [multiPayer, setMultiPayer] = useState(
    Boolean(expense && expense.paidBy.length > 1),
  );
  const [primaryPayerId, setPrimaryPayerId] = useState('');
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);
  const [uploading, setUploading] = useState(false);

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/api/users');
      return data.users as User[];
    },
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

  const users = usersQuery.data || [];
  const groups = groupsQuery.data || [];
  const categories = categoriesQuery.data || [];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: expense?.description || '',
      amount: expense ? expense.amountPaise / 100 : undefined,
      date: expense ? new Date(expense.date).toISOString().slice(0, 10) : todayInput(),
      categoryId: expense ? (typeof expense.category === 'string' ? expense.category : expense.category._id) : '',
      groupId: expense
        ? expense.group
          ? typeof expense.group === 'string'
            ? expense.group
            : expense.group._id
          : 'none'
        : defaultGroupId || 'none',
      notes: expense?.notes || '',
      currency: expense?.currency || 'INR',
      exchangeRate: expense?.exchangeRate || 1,
      receiptUrl: expense?.receiptUrl || '',
    },
  });

  const amount = watch('amount');
  const amountNumber = Number(amount) || 0;
  const amountPaise = Math.round(amountNumber * 100);
  const currency = watch('currency');
  const groupId = watch('groupId');
  const receiptUrl = watch('receiptUrl');

  const selectedGroup = groups.find((group) => group._id === groupId);
  const availablePeople = useMemo(() => {
    if (selectedGroup) return selectedGroup.members;
    return users;
  }, [selectedGroup, users]);

  const preview = useMemo(
    () => previewSplits(amountPaise, splitMethod, participants, splitValues),
    [amountPaise, splitMethod, participants, splitValues],
  );

  useEffect(() => {
    if (initialized || !users.length || groupsQuery.isLoading || categoriesQuery.isLoading) return;

    if (expense) {
      setParticipants(expense.splits.map((split) => person(split.user)._id));
      setPrimaryPayerId(person(expense.paidBy[0]?.user)._id || users[0]._id);
      const amounts: Record<string, string> = {};
      expense.paidBy.forEach((payer) => {
        amounts[person(payer.user)._id] = (payer.amountPaise / 100).toFixed(2);
      });
      setPayerAmounts(amounts);
      const values: Record<string, string> = {};
      expense.splits.forEach((split) => {
        const id = person(split.user)._id;
        if (expense.splitMethod === 'exact' || expense.splitMethod === 'unequal') {
          values[id] = (split.amountPaise / 100).toFixed(2);
        } else if (expense.splitMethod === 'percentage') {
          values[id] = String(split.value ?? 0);
        } else if (expense.splitMethod === 'shares') {
          values[id] = String(split.value ?? 1);
        }
      });
      setSplitValues(values);
    } else {
      const group = groups.find((entry) => entry._id === defaultGroupId);
      const people = group ? group.members : users;
      setParticipants(people.map((member) => member._id));
      setPrimaryPayerId(user?._id && people.some((member) => member._id === user._id) ? user._id : people[0]?._id || '');
    }
    setInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, groups, categories, expense, initialized]);

  useEffect(() => {
    if (!categories.length) return;
    const current = watch('categoryId');
    if (!current) setValue('categoryId', categories[0]._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, setValue]);

  const seedValues = (method: SplitMethod, ids: string[], totalRupees: number) => {
    const next: Record<string, string> = {};
    if (method === 'percentage') {
      const base = ids.length ? 100 / ids.length : 0;
      let used = 0;
      ids.forEach((id, index) => {
        const value = index === ids.length - 1 ? Number((100 - used).toFixed(2)) : Number(base.toFixed(2));
        used += value;
        next[id] = String(value);
      });
    } else if (method === 'shares') {
      ids.forEach((id) => {
        next[id] = '1';
      });
    } else if (method === 'exact' || method === 'unequal') {
      const parts = allocatePaise(Math.round(totalRupees * 100), ids.map(() => 1));
      ids.forEach((id, index) => {
        next[id] = (parts[index] / 100).toFixed(2);
      });
    }
    setSplitValues(next);
  };

  const changeMethod = (method: SplitMethod) => {
    setSplitMethod(method);
    if (method !== 'equal') seedValues(method, participants, amountNumber);
  };

  const changeGroup = (value: string) => {
    setValue('groupId', value);
    const group = groups.find((entry) => entry._id === value);
    const people = group ? group.members : users;
    const ids = people.map((member) => member._id);
    setParticipants(ids);
    if (!ids.includes(primaryPayerId)) setPrimaryPayerId(ids[0] || '');
    setPayerAmounts({});
    if (splitMethod !== 'equal') seedValues(splitMethod, ids, amountNumber);
  };

  const toggleParticipant = (id: string) => {
    setParticipants((current) => {
      const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
      if (splitMethod !== 'equal') {
        setSplitValues((values) => {
          const updated = { ...values };
          if (next.includes(id) && !updated[id]) {
            updated[id] = splitMethod === 'shares' ? '1' : '0';
          }
          return updated;
        });
      }
      return next;
    });
  };

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      setUploading(true);
      const { data } = await api.post('/api/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setValue('receiptUrl', data.url);
      toast.success('Receipt uploaded');
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!participants.length) {
      toast.error('Select at least one participant');
      return;
    }
    if (!preview.valid) {
      toast.error(preview.error || 'Check the split amounts');
      return;
    }

    let paidBy: { user: string; amount: number }[] = [];
    if (multiPayer) {
      paidBy = Object.entries(payerAmounts)
        .filter(([id, value]) => participants.includes(id) && Number(value) > 0)
        .map(([id, value]) => ({ user: id, amount: Number(value) }));
    } else if (primaryPayerId) {
      paidBy = [{ user: primaryPayerId, amount: Number(values.amount) }];
    }

    if (!paidBy.length) {
      toast.error('Choose who paid');
      return;
    }
    const payerTotal = paidBy.reduce((sum, entry) => sum + Math.round(entry.amount * 100), 0);
    if (payerTotal !== amountPaise) {
      toast.error(
        `Payments total ${formatMoney(payerTotal)} but the expense is ${formatMoney(amountPaise)}`,
      );
      return;
    }

    const payload = {
      description: values.description,
      amount: Number(values.amount),
      currency: values.currency,
      exchangeRate: values.currency === 'INR' ? 1 : Number(values.exchangeRate),
      category: values.categoryId,
      group: values.groupId === 'none' ? null : values.groupId,
      date: new Date(`${values.date}T12:00:00`).toISOString(),
      notes: values.notes,
      receiptUrl: values.receiptUrl,
      paidBy,
      splitMethod,
      participants: participants.map((id) => ({
        user: id,
        value: splitMethod === 'equal' ? null : Number(splitValues[id] || 0),
      })),
    };

    try {
      const response = expense
        ? await api.put(`/api/expenses/${expense._id}`, payload)
        : await api.post('/api/expenses', payload, {
            headers: { 'Idempotency-Key': idempotencyKey.current },
          });
      const saved = response.data.expense as Expense;
      await queryClient.invalidateQueries();
      toast.success(expense ? 'Expense updated' : 'Expense added');
      onSaved?.(saved);
    } catch (error) {
      toast.error(apiError(error));
    }
  });

  if (!initialized) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Preparing the form…
        </CardContent>
      </Card>
    );
  }

  const payerOptions = availablePeople.length ? availablePeople : users;

  return (
    <form onSubmit={onSubmit} className={cn('space-y-4', compact && 'space-y-3')}>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Expense details</CardTitle>
          <CardDescription>What was this spend for?</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Dinner at Truffles"
              className="mt-1.5"
              {...register('description')}
            />
            {errors.description ? (
              <p className="mt-1 text-xs font-medium text-destructive">{errors.description.message}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="amount">Amount ({currency})</Label>
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="mt-1.5 text-lg font-semibold"
              {...register('amount', { valueAsNumber: true })}
            />
            {errors.amount ? (
              <p className="mt-1 text-xs font-medium text-destructive">{errors.amount.message}</p>
            ) : null}
          </div>
          <div>
            <Label>Category</Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category._id} value={category._id}>
                        <span className="flex items-center gap-2">
                          <CategoryIcon icon={category.icon} color={category.color} className="h-6 w-6 rounded-md" />
                          {category.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.categoryId ? (
              <p className="mt-1 text-xs font-medium text-destructive">{errors.categoryId.message}</p>
            ) : null}
          </div>
          <div>
            <Label>Group</Label>
            <Select value={groupId} onValueChange={changeGroup}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="No group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No group (personal)</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group._id} value={group._id}>
                    {group.emoji} {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" className="mt-1.5" {...register('date')} />
            {errors.date ? (
              <p className="mt-1 text-xs font-medium text-destructive">{errors.date.message}</p>
            ) : null}
          </div>
          <div>
            <Label>Currency</Label>
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {currency !== 'INR' ? (
            <div>
              <Label htmlFor="exchangeRate">Exchange rate (INR per 1 {currency})</Label>
              <Input
                id="exchangeRate"
                type="number"
                step="0.0001"
                className="mt-1.5"
                {...register('exchangeRate', { valueAsNumber: true })}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Stored with the expense so balances remain stable.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Paid by</CardTitle>
              <CardDescription>Who actually paid this expense?</CardDescription>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              Multiple payers
              <Switch
                checked={multiPayer}
                onCheckedChange={(checked) => {
                  setMultiPayer(checked);
                  if (checked && primaryPayerId) {
                    setPayerAmounts({ [primaryPayerId]: String(amountNumber) });
                  }
                }}
              />
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!multiPayer ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={primaryPayerId} onValueChange={setPrimaryPayerId}>
                <SelectTrigger className="sm:max-w-xs">
                  <SelectValue placeholder="Choose a payer" />
                </SelectTrigger>
                <SelectContent>
                  {payerOptions.map((member) => (
                    <SelectItem key={member._id} value={member._id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                paid <strong className="font-semibold text-foreground">{formatMoney(amountPaise)}</strong> in full
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {payerOptions
                .filter((member) => participants.includes(member._id))
                .map((member) => (
                  <div key={member._id} className="flex items-center gap-3 rounded-xl border border-border/70 p-2.5">
                    <Avatar name={member.name} color={member.avatarColor} src={member.avatarUrl} size="sm" />
                    <span className="flex-1 truncate text-sm font-medium">{member.name}</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-9 w-28 text-right"
                      placeholder="0.00"
                      value={payerAmounts[member._id] || ''}
                      onChange={(event) =>
                        setPayerAmounts((current) => ({ ...current, [member._id]: event.target.value }))
                      }
                    />
                  </div>
                ))}
              <p className="text-xs text-muted-foreground">
                Payments total{' '}
                <span className="font-semibold text-foreground">
                  {formatMoney(
                    Object.entries(payerAmounts)
                      .filter(([id]) => participants.includes(id))
                      .reduce((sum, [, value]) => sum + Math.round(Number(value || 0) * 100), 0),
                  )}
                </span>{' '}
                of {formatMoney(amountPaise)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Split</CardTitle>
          <CardDescription>Choose who shares this expense and how.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={splitMethod} onValueChange={(value) => changeMethod(value as SplitMethod)}>
            <TabsList className="w-full flex-wrap justify-start sm:w-auto">
              {METHODS.map((method) => (
                <TabsTrigger key={method.value} value={method.value}>
                  {method.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const ids = payerOptions.map((member) => member._id);
                setParticipants(ids);
                if (splitMethod !== 'equal') seedValues(splitMethod, ids, amountNumber);
              }}
            >
              <Users className="h-3.5 w-3.5" /> Everyone
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setParticipants([])}>
              Clear
            </Button>
            <span className="text-xs text-muted-foreground">
              {participants.length} selected · {splitMethod === 'equal' ? 'equal shares' : METHODS.find((m) => m.value === splitMethod)?.label}
            </span>
          </div>

          <div className="divide-y divide-border/60 rounded-xl border border-border/70">
            {payerOptions.map((member) => {
              const selected = participants.includes(member._id);
              const share = preview.shares[member._id] || 0;
              return (
                <div
                  key={member._id}
                  className={cn(
                    'flex items-center gap-3 p-2.5 transition',
                    selected ? 'bg-primary/[0.03]' : 'opacity-70',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleParticipant(member._id)}
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition',
                      selected
                        ? 'border-primary bg-primary text-white'
                        : 'border-border bg-card text-transparent hover:border-primary/40',
                    )}
                    aria-label={`Toggle ${member.name}`}
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <Avatar name={member.name} color={member.avatarColor} src={member.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{member.name}</p>
                    {member._id === user?._id ? (
                      <p className="text-[10px] uppercase tracking-wide text-primary">You</p>
                    ) : null}
                  </div>
                  {selected && splitMethod !== 'equal' ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">
                        {splitMethod === 'percentage' ? '%' : splitMethod === 'shares' ? 'shares' : currency}
                      </span>
                      <Input
                        type="number"
                        step={splitMethod === 'shares' ? '1' : '0.01'}
                        min="0"
                        className="h-8 w-20 text-right text-xs"
                        value={splitValues[member._id] ?? ''}
                        onChange={(event) =>
                          setSplitValues((values) => ({ ...values, [member._id]: event.target.value }))
                        }
                      />
                    </div>
                  ) : null}
                  <span
                    className={cn(
                      'w-20 shrink-0 text-right text-sm font-semibold tabular-nums',
                      selected ? 'text-foreground' : 'text-muted-foreground/60',
                    )}
                  >
                    {selected ? formatMoney(share) : '—'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2.5 text-xs">
            <span className="text-muted-foreground">
              Allocated <strong className="text-foreground">{formatMoney(preview.total)}</strong> of{' '}
              <strong className="text-foreground">{formatMoney(amountPaise)}</strong>
            </span>
            {preview.valid ? (
              <Badge variant="positive">
                <Check className="h-3 w-3" /> Balanced
              </Badge>
            ) : (
              <Badge variant="negative">{preview.error}</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>More details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              className="mt-1.5"
              placeholder="Anything worth remembering about this expense"
              {...register('notes')}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Receipt</Label>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <input
                ref={receiptInput}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleUpload(file);
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => receiptInput.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {receiptUrl ? 'Replace receipt' : 'Upload receipt'}
              </Button>
              {receiptUrl ? (
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Receipt className="h-3.5 w-3.5" />
                  <a href={receiptUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                    View attachment
                  </a>
                  <button type="button" onClick={() => setValue('receiptUrl', '')} aria-label="Remove receipt">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Images or PDF · up to 5 MB</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-3 z-10 flex items-center justify-end gap-2 rounded-xl border border-border/70 bg-card/90 p-3 shadow-soft backdrop-blur">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting || uploading}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {expense ? 'Save changes' : 'Add expense'}
        </Button>
      </div>
    </form>
  );
}
