import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  ArrowRight,
  Check,
  Copy,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Avatar } from '@/components/ui/avatar';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, apiError } from '@/lib/api';
import { colorForName, copyText, publicSplitUrl } from '@/lib/public';
import { allocatePaise } from '@/lib/split';
import { cn, formatDate, formatMoney, todayInput } from '@/lib/utils';
import type {
  PublicPerson,
  PublicSplitExpense,
  PublicSplitPayload,
} from '@/types';

interface ExpenseDraft {
  description: string;
  amount: number;
  paidBy: string;
  participants: string[];
  date: string;
}

export default function PublicSplitDetailPage() {
  const { code = '' } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const splitQuery = useQuery({
    queryKey: ['public-split', code],
    queryFn: async () => {
      const { data } = await api.get(`/api/public/splits/${code}`);
      return data as PublicSplitPayload;
    },
    enabled: Boolean(code),
  });

  const payload = splitQuery.data;
  const split = payload?.split;
  const summary = payload?.summary;
  const directPayments = summary?.directPayments ?? [];

  const [paidBy, setPaidBy] = useState('');
  const [participantKeys, setParticipantKeys] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayInput());
  const [personDraft, setPersonDraft] = useState('');

  const [renameOpen, setRenameOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [personToRemove, setPersonToRemove] = useState<PublicPerson | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<PublicSplitExpense | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const initializedCode = useRef<string | null>(null);

  const applyPayload = (data: PublicSplitPayload) => {
    queryClient.setQueryData(['public-split', code], data);
    queryClient.invalidateQueries({ queryKey: ['public-splits'] });
  };

  useEffect(() => {
    if (!split) return;
    if (initializedCode.current === split.code) return;
    initializedCode.current = split.code;
    setPaidBy(split.people[0]?.key ?? '');
    setParticipantKeys(split.people.map((person) => person.key));
  }, [split]);

  useEffect(() => {
    if (!split) return;
    setParticipantKeys((current) =>
      current.filter((key) => split.people.some((person) => person.key === key)),
    );
    setPaidBy((current) =>
      split.people.some((person) => person.key === current)
        ? current
        : split.people[0]?.key ?? '',
    );
  }, [split]);

  const addPersonMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.patch(`/api/public/splits/${code}`, { addPeople: [name] });
      return data as PublicSplitPayload;
    },
    onSuccess: (data, name) => {
      applyPayload(data);
      const added = data.split.people.find((person) => person.name === name);
      if (added) setParticipantKeys((current) => [...current, added.key]);
      setPersonDraft('');
      toast.success(`${name} added`);
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const removePersonMutation = useMutation({
    mutationFn: async (person: PublicPerson) => {
      const { data } = await api.delete(`/api/public/splits/${code}/people/${person.key}`);
      return data as PublicSplitPayload;
    },
    onSuccess: (data, person) => {
      applyPayload(data);
      setParticipantKeys((current) => current.filter((key) => key !== person.key));
      setPersonToRemove(null);
      toast.success(`${person.name} removed`);
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const addExpenseMutation = useMutation({
    mutationFn: async (draft: ExpenseDraft) => {
      const { data } = await api.post(`/api/public/splits/${code}/expenses`, draft);
      return data as PublicSplitPayload;
    },
    onSuccess: (data) => {
      applyPayload(data);
      setDescription('');
      setAmount('');
      toast.success('Payment logged');
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      const { data } = await api.delete(`/api/public/splits/${code}/expenses/${expenseId}`);
      return data as PublicSplitPayload;
    },
    onSuccess: (data) => {
      applyPayload(data);
      setExpenseToDelete(null);
      toast.success('Payment removed');
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const renameMutation = useMutation({
    mutationFn: async (title: string) => {
      const { data } = await api.patch(`/api/public/splits/${code}`, { title });
      return data as PublicSplitPayload;
    },
    onSuccess: (data) => {
      applyPayload(data);
      setRenameOpen(false);
      toast.success('Split renamed');
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const deleteSplitMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/public/splits/${code}`);
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['public-split', code] });
      queryClient.invalidateQueries({ queryKey: ['public-splits'] });
      toast.success('Split deleted');
      navigate('/splits');
    },
    onError: (error) => toast.error(apiError(error)),
  });

  if (splitQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="h-4 w-28 animate-pulse rounded bg-card" />
        <div className="mt-6 h-14 w-2/3 animate-pulse rounded-lg bg-card" />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <div className="h-40 animate-pulse rounded-lg bg-card" />
            <div className="h-72 animate-pulse rounded-lg bg-card" />
          </div>
          <div className="h-72 animate-pulse rounded-lg bg-card" />
        </div>
      </div>
    );
  }

  if (splitQuery.isError || !split || !summary) {
    const notFound =
      axios.isAxiosError(splitQuery.error) && splitQuery.error.response?.status === 404;
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-24 text-center sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-primary">
          {notFound ? 'Off the board' : 'Something went wrong'}
        </p>
        <h1 className="mt-3 font-display text-5xl font-extrabold uppercase leading-none">
          {notFound ? 'Split not found' : 'Could not load it'}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {notFound
            ? 'This link may have expired, been deleted, or the code is mistyped.'
            : 'The split could not be loaded right now. Refresh to try again.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/splits" className={buttonVariants()}>
            Browse recent splits
          </Link>
          <Button variant="outline" onClick={() => splitQuery.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const people = split.people;
  const nameByKey = new Map(people.map((person) => [person.key, person.name]));
  const selectedKeys = participantKeys.filter((key) => nameByKey.has(key));
  const amountPaise = Math.round(Number(amount) * 100);
  const validAmount = Number.isFinite(amountPaise) && amountPaise > 0;
  const previewShares =
    validAmount && selectedKeys.length
      ? allocatePaise(amountPaise, selectedKeys.map(() => 1))
      : [];

  const totalsByPerson = people.map((person) => {
    const outgoing = directPayments.filter((payment) => payment.from.key === person.key);
    const incoming = directPayments.filter((payment) => payment.to.key === person.key);
    return {
      person,
      outgoing,
      payPaise: outgoing.reduce((sum, payment) => sum + payment.amountPaise, 0),
      receivePaise: incoming.reduce((sum, payment) => sum + payment.amountPaise, 0),
    };
  });
  const movingPaise = totalsByPerson.reduce((sum, row) => sum + row.payPaise, 0);

  const toggleParticipant = (key: string) => {
    setParticipantKeys((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
    );
  };

  const submitPerson = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = personDraft.trim();
    if (!name) return;
    if (people.length >= 40) {
      toast.error('That is the maximum number of people for one split');
      return;
    }
    if (people.some((person) => person.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`${name} is already on the split`);
      return;
    }
    addPersonMutation.mutate(name);
  };

  const submitExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (addExpenseMutation.isPending) return;
    if (!description.trim()) {
      toast.error('What was this payment for?');
      return;
    }
    if (!validAmount) {
      toast.error('Enter an amount greater than zero');
      return;
    }
    if (!paidBy) {
      toast.error('Choose who paid');
      return;
    }
    if (!selectedKeys.length) {
      toast.error('Pick at least one person to share this bill');
      return;
    }
    addExpenseMutation.mutate({
      description: description.trim(),
      amount: amountPaise / 100,
      paidBy,
      participants: selectedKeys,
      date,
    });
  };

  const nativeShare = (
    navigator as Navigator & {
      share?: (data: { title?: string; url?: string }) => Promise<void>;
    }
  ).share;

  const shareLink = async () => {
    const url = publicSplitUrl(split.code);
    try {
      await copyText(url);
      toast.success('Link copied — send it to the group');
      return;
    } catch {
      // Fall through to the native share sheet or the manual copy dialog.
    }

    if (nativeShare) {
      try {
        await nativeShare.call(navigator, { title: split.title, url });
        return;
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
      }
    }

    setShareUrl(url);
    setShareOpen(true);
  };

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(75%_120%_at_80%_-20%,rgba(229,9,20,0.34),transparent_65%)]"
      />
      <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <Link
          to="/splits"
          className="text-[13px] font-medium text-muted-foreground transition hover:text-foreground"
        >
          ← All splits
        </Link>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.3em] text-primary">
              Public split
              <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em] text-primary">
                {split.code}
              </span>
            </p>
            <h1 className="mt-2 font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-tight sm:text-6xl lg:text-7xl">
              {split.title}
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> {summary.peopleCount} people
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5" /> {summary.expenseCount}{' '}
                {summary.expenseCount === 1 ? 'payment' : 'payments'}
              </span>
              <span className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
                {formatMoney(summary.totalPaise)} total
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={shareLink}>
              <Copy className="h-4 w-4" /> Share link
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setTitleDraft(split.title);
                setRenameOpen(true);
              }}
            >
              <Pencil className="h-4 w-4" /> Rename
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete this split"
              className="text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <section className="rounded-lg border border-border/70 bg-card/80 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
                    The group
                  </h2>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {people.length} on this split
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {people.map((person) => (
                  <span
                    key={person.key}
                    className="inline-flex items-center gap-2 rounded-md border border-border/70 bg-secondary/50 py-1 pl-1 pr-1.5 text-sm"
                  >
                    <Avatar
                      name={person.name}
                      color={colorForName(person.name)}
                      size="sm"
                      className="h-6 w-6 text-[10px] ring-0"
                    />
                    {person.name}
                    <button
                      type="button"
                      aria-label={`Remove ${person.name}`}
                      onClick={() => setPersonToRemove(person)}
                      className="rounded p-1 text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>

              <form onSubmit={submitPerson} className="mt-4 flex gap-2">
                <Input
                  value={personDraft}
                  onChange={(event) => setPersonDraft(event.target.value)}
                  placeholder="Add someone by name"
                  maxLength={60}
                  aria-label="Person name"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={!personDraft.trim() || addPersonMutation.isPending}
                >
                  {addPersonMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add
                </Button>
              </form>
            </section>

            <section className="rounded-lg border border-border/70 bg-card/80 p-5">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
                  Log a payment
                </h2>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Different people can pay for different things — add each bill once and pick who it
                covers.
              </p>

              {people.length === 0 ? (
                <p className="mt-4 rounded-md border border-dashed border-border/80 px-3 py-4 text-sm text-muted-foreground">
                  Add at least one person above before logging a payment.
                </p>
              ) : (
                <form onSubmit={submitExpense} className="mt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_150px]">
                    <div>
                      <Label htmlFor="expense-description">What was paid for?</Label>
                      <Input
                        id="expense-description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Dinner, cab, tickets…"
                        maxLength={120}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="expense-amount">Amount (₹)</Label>
                      <Input
                        id="expense-amount"
                        value={amount}
                        onChange={(event) =>
                          setAmount(event.target.value.replace(/[^0-9.]/g, ''))
                        }
                        inputMode="decimal"
                        placeholder="0.00"
                        className="mt-1.5 tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="expense-payer">Who paid?</Label>
                      <Select value={paidBy} onValueChange={setPaidBy}>
                        <SelectTrigger id="expense-payer" className="mt-1.5">
                          <SelectValue placeholder="Choose a person" />
                        </SelectTrigger>
                        <SelectContent>
                          {people.map((person) => (
                            <SelectItem key={person.key} value={person.key}>
                              {person.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="expense-date">Date</Label>
                      <Input
                        id="expense-date"
                        type="date"
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label>Who shares this bill?</Label>
                      <div className="flex items-center gap-1">
                        <span className="mr-1 text-[11px] text-muted-foreground">
                          {selectedKeys.length}/{people.length}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setParticipantKeys(people.map((person) => person.key))}
                        >
                          Everyone
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setParticipantKeys([])}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {people.map((person) => {
                        const active = selectedKeys.includes(person.key);
                        return (
                          <button
                            key={person.key}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggleParticipant(person.key)}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[13px] font-medium transition',
                              active
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border/80 bg-secondary/40 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                            )}
                          >
                            {active ? <Check className="h-3.5 w-3.5" /> : null}
                            {person.name}
                          </button>
                        );
                      })}
                    </div>
                    {previewShares.length ? (
                      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-[11px] text-muted-foreground">
                        <span className="font-semibold uppercase tracking-wide text-foreground">
                          Each pays
                        </span>
                        {selectedKeys.map((key, index) => (
                          <span key={key}>
                            <span className="text-foreground">{nameByKey.get(key)}</span>{' '}
                            {formatMoney(previewShares[index])}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={addExpenseMutation.isPending}>
                      {addExpenseMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Add payment
                    </Button>
                  </div>
                </form>
              )}
            </section>

            <section className="flex-1 overflow-hidden rounded-lg border border-border/70 bg-card/80">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-5 py-4">
                <div>
                  <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
                    The tab
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {summary.expenseCount}{' '}
                    {summary.expenseCount === 1 ? 'payment' : 'payments'} ·{' '}
                    {formatMoney(summary.totalPaise)}
                  </p>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Newest first
                </span>
              </div>

              {split.expenses.length ? (
                <ul className="divide-y divide-border/60">
                  {split.expenses.map((expense) => (
                    <li
                      key={expense._id}
                      className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{expense.description}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {expense.payer?.name ?? 'Someone'} paid · {formatDate(expense.date)}
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          Each person's share:{' '}
                          {expense.splits
                            .map(
                              (part) =>
                                `${part.person?.name ?? 'Someone'} ${formatMoney(part.amountPaise)}`,
                            )
                            .join(' · ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-xl font-semibold tabular-nums">
                          {formatMoney(expense.amountPaise)}
                        </span>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Delete ${expense.description}`}
                          className="text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                          onClick={() => setExpenseToDelete(expense)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-8 text-sm text-muted-foreground">
                  No payments logged yet. Add the first bill above.
                </p>
              )}
            </section>
          </div>

          <aside className="flex flex-col gap-4">
            <section className="overflow-hidden rounded-lg border border-primary/40 bg-[linear-gradient(160deg,rgba(229,9,20,0.2),rgba(20,20,20,0.05)_55%,transparent)] p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
                Settle up
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold uppercase leading-tight">
                Who pays whom
              </h2>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Each person pays back whoever actually paid for their share. Nothing is netted
                through someone else.
              </p>

              {directPayments.length ? (
                <ul className="mt-4 space-y-1.5">
                  {directPayments.map((payment, index) => (
                    <li
                      key={`${payment.from.key}-${payment.to.key}-${index}`}
                      className="flex items-center gap-2 rounded-md border border-border/70 bg-background/50 px-3 py-2 text-sm"
                    >
                      <span className="truncate font-medium">{payment.from.name}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate font-medium">{payment.to.name}</span>
                      <span className="ml-auto shrink-0 font-display font-semibold tabular-nums text-primary">
                        {formatMoney(payment.amountPaise)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-md border border-dashed border-border/80 px-3 py-4 text-sm text-muted-foreground">
                  {summary.expenseCount
                    ? 'All square — nobody owes anybody.'
                    : 'Add a payment to see the settlement list.'}
                </p>
              )}

              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                SplitMate only does the maths — no money moves in the app.
              </p>
            </section>

            <section className="rounded-lg border border-border/70 bg-card/80 p-5">
              <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
                Everyone's total
              </h2>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Paid is what each person put in. Should pay is their share of every bill. Net is
                paid minus should pay.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="pb-2 pr-2 font-semibold">Person</th>
                      <th className="px-2 pb-2 text-right font-semibold">Paid</th>
                      <th className="px-2 pb-2 text-right font-semibold">Should pay</th>
                      <th className="pb-2 pl-2 text-right font-semibold">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {summary.balances.map((row) => (
                      <tr key={row.person.key}>
                        <td className="py-2 pr-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <Avatar
                              name={row.person.name}
                              color={colorForName(row.person.name)}
                              size="sm"
                              className="h-6 w-6 text-[10px] ring-0"
                            />
                            <span className="truncate font-medium">{row.person.name}</span>
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {formatMoney(row.paidPaise)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {formatMoney(row.sharePaise)}
                        </td>
                        <td
                          className={cn(
                            'py-2 pl-2 text-right font-semibold tabular-nums',
                            row.netPaise > 0
                              ? 'text-positive'
                              : row.netPaise < 0
                                ? 'text-negative'
                                : 'text-muted-foreground',
                          )}
                        >
                          {formatMoney(row.netPaise, { signed: true })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border/70 text-[11px] font-semibold">
                      <td className="pt-2 pr-2 uppercase tracking-[0.12em] text-muted-foreground">
                        Total
                      </td>
                      <td className="px-2 pt-2 text-right tabular-nums">
                        {formatMoney(summary.totalPaise)}
                      </td>
                      <td className="px-2 pt-2 text-right tabular-nums">
                        {formatMoney(summary.totalPaise)}
                      </td>
                      <td className="pl-2 pt-2 text-right tabular-nums">
                        {formatMoney(0, { signed: true })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <section className="flex-1 rounded-lg border border-border/70 bg-card/80 p-5">
              <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
                Total per person
              </h2>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Everyone is listed. Pays is their total across all bills; receives is what others
                owe them.
              </p>
              <ul className="mt-3 divide-y divide-border/50">
                {totalsByPerson.map((row) => (
                  <li key={row.person.key} className="py-3">
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={row.person.name}
                        color={colorForName(row.person.name)}
                        size="sm"
                        className="h-6 w-6 text-[10px] ring-0"
                      />
                      <span className="min-w-0 truncate font-medium">{row.person.name}</span>
                      <span className="ml-auto shrink-0 text-right text-[11px] leading-tight text-muted-foreground">
                        pays{' '}
                        <span className="font-display text-sm font-semibold tabular-nums text-foreground">
                          {formatMoney(row.payPaise)}
                        </span>
                        {row.receivePaise > 0 ? (
                          <>
                            {' '}
                            · receives{' '}
                            <span className="font-display text-sm font-semibold tabular-nums text-positive">
                              {formatMoney(row.receivePaise)}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </div>
                    {row.outgoing.length ? (
                      <div className="mt-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                          Send to
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {row.outgoing.map((payment) => (
                            <li
                              key={`${payment.from.key}-${payment.to.key}`}
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <span className="truncate font-medium text-foreground">
                                {payment.to.name}
                              </span>
                              <span className="shrink-0 font-display font-semibold tabular-nums text-foreground">
                                {formatMoney(payment.amountPaise)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="mt-2 pl-8 text-xs text-muted-foreground">Nothing to pay.</p>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                Money moving between people: {formatMoney(movingPaise)}. Each payer's own share
                stays with them and is not a transfer.
              </p>
            </section>
          </aside>
        </div>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename this split</DialogTitle>
            <DialogDescription>
              Everyone with the link sees the new name immediately.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            maxLength={80}
            aria-label="Split title"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!titleDraft.trim() || renameMutation.isPending}
              onClick={() => renameMutation.mutate(titleDraft.trim())}
            >
              {renameMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(personToRemove)}
        onOpenChange={(open) => {
          if (!open) setPersonToRemove(null);
        }}
        title={`Remove ${personToRemove?.name ?? 'this person'}?`}
        description="They will disappear from the group and settlement list. People with payments can only be removed after those payments are deleted."
        confirmLabel="Remove person"
        destructive
        onConfirm={async () => {
          if (personToRemove) await removePersonMutation.mutateAsync(personToRemove);
        }}
      />

      <ConfirmDialog
        open={Boolean(expenseToDelete)}
        onOpenChange={(open) => {
          if (!open) setExpenseToDelete(null);
        }}
        title={`Delete “${expenseToDelete?.description ?? 'this payment'}”?`}
        description="The payment is removed for everyone and the balances update right away."
        confirmLabel="Delete payment"
        destructive
        onConfirm={async () => {
          if (expenseToDelete) await deleteExpenseMutation.mutateAsync(expenseToDelete._id);
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this split?"
        description="The link stops working and every payment on it is removed for everyone. This cannot be undone."
        confirmLabel="Delete split"
        destructive
        onConfirm={async () => {
          await deleteSplitMutation.mutateAsync();
        }}
      />

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send this split link</DialogTitle>
            <DialogDescription>
              This browser blocked automatic copying. Select the link below and copy it, or share
              it straight to WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <Input
            readOnly
            value={shareUrl}
            aria-label="Split link"
            onFocus={(event) => event.currentTarget.select()}
            onClick={(event) => event.currentTarget.select()}
          />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            The app didn't open?{' '}
            <a
              className="font-semibold text-primary underline-offset-4 hover:underline"
              href={`https://wa.me/?text=${encodeURIComponent(`${split.title} — ${shareUrl}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              Use WhatsApp Web
            </a>
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShareOpen(false)}>
              Close
            </Button>
            <a
              className={buttonVariants({ variant: 'secondary' })}
              href={`whatsapp://send?text=${encodeURIComponent(`${split.title} — ${shareUrl}`)}`}
            >
              Open WhatsApp
            </a>
            <Button
              onClick={async () => {
                try {
                  await copyText(shareUrl);
                  toast.success('Link copied');
                  setShareOpen(false);
                } catch {
                  toast.error('Press and hold the link to copy it.');
                }
              }}
            >
              Try copy again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
