import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, Check, Eye, EyeOff, Loader2, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/auth';
import { api, apiError } from '@/lib/api';
import type { User } from '@/types';

export default function RegisterPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/auth/register', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      return data.user as User;
    },
    onSuccess: (created) => {
      toast.success(`Welcome to SplitMate, ${created.name}`);
      signIn(created);
      navigate('/dashboard', { replace: true });
    },
    onError: (registerError) => {
      const message = apiError(registerError);
      setError(message);
      toast.error(message);
    },
  });

  const passwordRules = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Contains a letter and a number', met: /[A-Za-z]/.test(password) && /\d/.test(password) },
  ];
  const passwordValid = passwordRules.every((rule) => rule.met);
  const canSubmit =
    name.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(email) &&
    passwordValid &&
    confirmPassword === password &&
    !mutation.isPending;

  return (
    <AuthShell>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Get started</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          If a friend already added you as a member, register with the same email to claim that
          profile and its history.
        </p>

        <form
          className="mt-7 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            mutation.mutate();
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
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              autoComplete="name"
              className="mt-1.5"
              placeholder="Sai Kumar"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
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
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="pr-11"
                placeholder="At least 8 characters"
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
            <ul className="mt-2 space-y-1">
              {passwordRules.map((rule) => (
                <li
                  key={rule.label}
                  className={`flex items-center gap-1.5 text-[11px] ${rule.met ? 'text-emerald-500' : 'text-muted-foreground'}`}
                >
                  {rule.met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  {rule.label}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="mt-1.5"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            {confirmPassword && confirmPassword !== password ? (
              <p className="mt-1 text-[11px] text-rose-400">Passwords do not match.</p>
            ) : null}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Stored as a bcrypt hash. Never shared or shown in the app.
            </p>
          </div>
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={!canSubmit}
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
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
