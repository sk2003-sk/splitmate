import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Loader2, Plus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, apiError } from '@/lib/api';
import { colorForName } from '@/lib/public';
import { cn } from '@/lib/utils';
import type { PublicSplitPayload } from '@/types';

export default function PublicSplitNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [people, setPeople] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  const addPerson = () => {
    const name = draft.trim();
    if (!name) return;
    if (people.length >= 40) {
      toast.error('That is the maximum number of people for one split');
      return;
    }
    if (people.some((person) => person.toLowerCase() === name.toLowerCase())) {
      toast.error(`${name} is already on the list`);
      return;
    }
    setPeople((current) => [...current, name]);
    setDraft('');
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/public/splits', {
        title: title.trim(),
        people,
      });
      return data as PublicSplitPayload;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['public-splits'] });
      toast.success('Split created — share the link with your group');
      navigate(`/split/${data.split.code}`);
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const canCreate = title.trim().length > 0 && people.length > 0 && !createMutation.isPending;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_90%_at_80%_0%,rgba(229,9,20,0.24),transparent_60%)]" />
      <div className="relative mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <Link to="/" className="text-[13px] font-medium text-muted-foreground transition hover:text-foreground">
          ← Back to home
        </Link>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.3em] text-primary">No account needed</p>
        <h1 className="mt-2 font-display text-5xl font-extrabold uppercase leading-[0.92] sm:text-6xl">
          Start tonight&apos;s split
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Name the tab, add everyone by name, and create a link the whole group can use. You can add
          more people and expenses later.
        </p>

        <Card className="mt-8 border-border/70 bg-card/80">
          <CardContent className="space-y-6 p-5 sm:p-6">
            <div>
              <Label htmlFor="split-title">What is this split for?</Label>
              <Input
                id="split-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Saturday night out"
                maxLength={80}
                className="mt-1.5 text-base"
                autoFocus
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="person-name">People</Label>
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {people.length} added
                </span>
              </div>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="person-name"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addPerson();
                    }
                  }}
                  placeholder="Type a name and press Enter"
                  maxLength={60}
                />
                <Button variant="secondary" onClick={addPerson} disabled={!draft.trim()}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>

              {people.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {people.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-2 rounded-md border border-border/70 bg-secondary/60 py-1 pl-1 pr-2 text-sm"
                    >
                      <Avatar name={name} color={colorForName(name)} size="sm" className="h-6 w-6 text-[10px]" />
                      {name}
                      <button
                        type="button"
                        aria-label={`Remove ${name}`}
                        onClick={() => setPeople((current) => current.filter((person) => person !== name))}
                        className="rounded p-0.5 text-muted-foreground transition hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-border/80 px-3 py-4 text-xs text-muted-foreground">
                  <Users className="h-4 w-4" /> Nobody added yet. Start with whoever was there.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Anyone with the link can open this split, add people and log expenses.
              </p>
              <Button
                size="lg"
                disabled={!canCreate}
                onClick={() => createMutation.mutate()}
                className={cn('shrink-0')}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Create split
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Want groups, settlements and a personal dashboard?{' '}
          <Link to="/login" className={cn(buttonVariants({ variant: 'link' }), 'h-auto p-0 text-xs')}>
            Use the ledger
          </Link>
        </p>
      </div>
    </div>
  );
}
