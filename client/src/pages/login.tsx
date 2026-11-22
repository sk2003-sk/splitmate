import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, Eye, EyeOff, Loader2, LogIn, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/context/auth';
import { api, apiError } from '@/lib/api';
import type { User } from '@/types';

export default function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const demoQuery = useQuery({
    queryKey: ['demo-users', 'login'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/api/auth/demo-users');
        return data.users as User[];
      } catch {
        return [] as User[];
      }
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });
      return data.user as User;
    },
    onSuccess: (signedIn) => {
      signIn(signedIn);
      navigate('/dashboard', { replace: true });
    },
    onError: (loginError) => {
      const message = apiError(loginError);
      setError(message);
      toast.error(message);
    },
  });

  const demoMutation = useMutation({
    mutationFn: async (candidate: User) => {
      const { data } = await api.post('/api/auth/demo', { userId: candidate._id });
      return data.user as User;
    },
    onSuccess: (signedIn) => {
      signIn(signedIn);
      navigate('/dashboard', { replace: true });
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const canSubmit = email.includes('@') && password.length > 0 && !loginMutation.isPending;

  return (
    <AuthShell>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Welcome back</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight">
          Sign in to SplitMate
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your personal ledger: monthly and yearly spending, groups, balances and settlements.
        </p>

        {demoQuery.data && demoQuery.data.length ? (
          <div className="mt-6 rounded-xl border border-primary/20 bg-primary/[0.04] p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Demo accounts
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              One-tap sign-in for the seeded members. Disabled automatically in production.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {demoQuery.data.map((candidate) => (
                <button
                  key={candidate._id}
                  type="button"
                  onClick={() => demoMutation.mutate(candidate)}
                  disabled={demoMutation.isPending}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-1 pr-2.5 text-xs font-semibold transition hover:border-primary/40 hover:bg-accent disabled:opacity-60"
                >
                  <Avatar name={candidate.name} color={candidate.avatarColor} size="sm" className="h-5 w-5 text-[8px]" />
                  {candidate.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <form
          className="mt-7 space-y-4"
          autoComplete="on"
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            loginMutation.mutate();
          }}
        >
          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-400"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          ) : null}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="mt-1.5"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative mt-1.5">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="pr-11"
                placeholder="Your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={!canSubmit}>
            {loginMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to SplitMate?{' '}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Just splitting tonight?{' '}
          <Link to="/split/new" className="font-semibold text-foreground hover:text-primary">
            Start a public split
          </Link>{' '}
          — no account needed.
        </p>
      </div>
    </AuthShell>
  );
}
