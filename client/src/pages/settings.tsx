import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  Copy,
  CreditCard,
  Download,
  Inbox,
  KeyRound,
  Loader2,
  Mail,
  MessageSquare,
  Moon,
  Palette,
  Plus,
  RefreshCcw,
  Repeat,
  Sun,
  Tag,
  Trash2,
  Upload,
  UserRound,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch, Separator } from '@/components/ui/primitives';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CategoryIcon } from '@/components/category-icon';
import { SmsSetupGuide } from '@/components/sms-setup-guide';
import { useAuth } from '@/context/auth';
import { useTheme, type Theme } from '@/context/theme';
import { api, apiError } from '@/lib/api';
import { cn, formatDate, formatMoney } from '@/lib/utils';
import type {
  Category,
  EmailCaptureInfo,
  EmailCaptureItem,
  Group,
  RecurringExpense,
  SmsCaptureInfo,
  User,
} from '@/types';

const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];
const CATEGORY_ICONS = [
  'Receipt',
  'UtensilsCrossed',
  'ShoppingBasket',
  'Plane',
  'ShoppingBag',
  'Home',
  'Zap',
  'Clapperboard',
  'Fuel',
  'HeartPulse',
];
const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Palette },
];

export default function SettingsPage() {
  const { user, setUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const avatarInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [upiId, setUpiId] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [budget, setBudget] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryIcon, setCategoryIcon] = useState('Receipt');
  const [categoryColor, setCategoryColor] = useState('#6366f1');
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  const [recurringOpen, setRecurringOpen] = useState(false);
  const [recurringDescription, setRecurringDescription] = useState('');
  const [recurringAmount, setRecurringAmount] = useState('');
  const [recurringCategory, setRecurringCategory] = useState('');
  const [recurringGroup, setRecurringGroup] = useState('none');
  const [recurringFrequency, setRecurringFrequency] = useState<'WEEKLY' | 'MONTHLY'>('MONTHLY');
  const [recurringStart, setRecurringStart] = useState(new Date().toISOString().slice(0, 10));
  const [deleteRecurringId, setDeleteRecurringId] = useState<string | null>(null);

  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [rotateEmailOpen, setRotateEmailOpen] = useState(false);
  const [disableEmailOpen, setDisableEmailOpen] = useState(false);
  const [smsToken, setSmsToken] = useState<string | null>(null);
  const [rotateSmsOpen, setRotateSmsOpen] = useState(false);
  const [disableSmsOpen, setDisableSmsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setEmail(user.email || '');
    setAvatarColor(user.avatarColor || AVATAR_COLORS[0]);
    setAvatarUrl(user.avatarUrl || '');
    setUpiId(user.upiId || '');
    setCurrency(user.defaultCurrency || 'INR');
    setBudget(user.monthlyBudgetPaise ? String(user.monthlyBudgetPaise / 100) : '');
  }, [user]);

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/api/categories');
      return data.categories as Category[];
    },
  });
  const recurringQuery = useQuery({
    queryKey: ['recurring'],
    queryFn: async () => {
      const { data } = await api.get('/api/recurring');
      return data.items as RecurringExpense[];
    },
  });
  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data } = await api.get('/api/groups');
      return data.groups as Group[];
    },
  });

  const emailCaptureQuery = useQuery({
    queryKey: ['capture', 'email'],
    queryFn: async () => {
      const { data } = await api.get('/api/capture/email');
      return data as EmailCaptureInfo;
    },
  });
  const emailCapturesQuery = useQuery({
    queryKey: ['capture', 'email', 'captures'],
    queryFn: async () => {
      const { data } = await api.get('/api/capture/email/captures');
      return data.captures as EmailCaptureItem[];
    },
    enabled: Boolean(emailCaptureQuery.data?.address),
  });

  const createEmailAddress = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/capture/email');
      return data.address as string;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['capture', 'email'] });
      toast.success('Private address created');
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const rotateEmailAddress = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/capture/email/rotate');
      return data.address as string;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['capture', 'email'] });
      setRotateEmailOpen(false);
      toast.success('New address created — update your forwarding rule');
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const disableEmailCapture = useMutation({
    mutationFn: async () => {
      await api.delete('/api/capture/email');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['capture', 'email'] });
      setDisableEmailOpen(false);
      toast.success('Email capture turned off');
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const copyEmailAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success('Address copied');
    } catch {
      toast.error('Could not copy — select the address and copy it manually');
    }
  };

  const smsCaptureQuery = useQuery({
    queryKey: ['capture', 'sms'],
    queryFn: async () => {
      const { data } = await api.get('/api/capture/sms');
      return data as SmsCaptureInfo;
    },
  });
  const smsCapturesQuery = useQuery({
    queryKey: ['capture', 'sms', 'captures'],
    queryFn: async () => {
      const { data } = await api.get('/api/capture/sms/captures');
      return data.captures as EmailCaptureItem[];
    },
    enabled: Boolean(smsCaptureQuery.data?.enabled),
  });

  const createSmsToken = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/capture/sms');
      return (data.token as string) || null;
    },
    onSuccess: async (token) => {
      await queryClient.invalidateQueries({ queryKey: ['capture', 'sms'] });
      if (token) {
        setSmsToken(token);
        toast.success('SMS token created — copy it now');
      } else {
        toast.info('SMS capture is already on. Rotate the token to see a new one.');
      }
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const rotateSmsToken = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/capture/sms/rotate');
      return data.token as string;
    },
    onSuccess: async (token) => {
      setSmsToken(token);
      await queryClient.invalidateQueries({ queryKey: ['capture', 'sms'] });
      setRotateSmsOpen(false);
      toast.success('New SMS token created — update your Shortcut');
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const disableSmsCapture = useMutation({
    mutationFn: async () => {
      await api.delete('/api/capture/sms');
    },
    onSuccess: async () => {
      setSmsToken(null);
      await queryClient.invalidateQueries({ queryKey: ['capture', 'sms'] });
      setDisableSmsOpen(false);
      toast.success('SMS capture turned off');
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const copySmsToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      toast.success('Token copied');
    } catch {
      toast.error('Could not copy — select the token and copy it manually');
    }
  };

  const smsEndpoint = `${api.defaults.baseURL || window.location.origin}/api/inbound/sms`;

  const copyEndpoint = async () => {
    try {
      await navigator.clipboard.writeText(smsEndpoint);
      toast.success('Endpoint URL copied');
    } catch {
      toast.error('Could not copy — select the URL and copy it manually');
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const { data } = await api.put(`/api/users/${user._id}`, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        avatarColor,
        avatarUrl,
        upiId: upiId.trim(),
        defaultCurrency: currency,
        monthlyBudget: budget === '' ? 0 : Number(budget),
      });
      setUser(data.user as User);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Profile saved');
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      setUploading(true);
      const { data } = await api.post('/api/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAvatarUrl(data.url);
      toast.success('Picture uploaded — save to apply');
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setUploading(false);
    }
  };

  const chooseTheme = async (value: Theme) => {
    setTheme(value);
    if (!user) return;
    try {
      await api.put(`/api/users/${user._id}`, { theme: value });
      setUser({ ...user, theme: value });
    } catch {
      /* Local theme still applies even if the preference was not persisted. */
    }
  };

  const createCategory = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/categories', {
        name: categoryName.trim(),
        icon: categoryIcon,
        color: categoryColor,
      });
      return data.category as Category;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category created');
      setCategoryOpen(false);
      setCategoryName('');
      setCategoryIcon('Receipt');
      setCategoryColor('#6366f1');
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/categories/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category deleted');
      setDeleteCategoryId(null);
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const recurringPayload = () => {
    if (!user) throw new Error('Not signed in');
    const group = groupsQuery.data?.find((entry) => entry._id === recurringGroup);
    const people = group ? group.members : [user];
    const amount = Number(recurringAmount);
    if (!recurringDescription.trim()) throw new Error('Add a description');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a valid amount');
    if (!recurringCategory) throw new Error('Choose a category');
    return {
      description: recurringDescription.trim(),
      amount,
      currency: 'INR',
      exchangeRate: 1,
      category: recurringCategory,
      group: recurringGroup === 'none' ? null : recurringGroup,
      notes: 'Scheduled recurring expense',
      paidBy: [{ user: user._id, amount }],
      splitMethod: 'equal' as const,
      participants: people.map((member) => ({ user: member._id, value: null })),
      frequency: recurringFrequency,
      startDate: new Date(`${recurringStart}T12:00:00`).toISOString(),
    };
  };

  const createRecurring = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/recurring', recurringPayload());
      return data.recurring as RecurringExpense;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success('Recurring expense scheduled');
      setRecurringOpen(false);
      setRecurringDescription('');
      setRecurringAmount('');
      setRecurringCategory('');
      setRecurringGroup('none');
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const toggleRecurring = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await api.put(`/api/recurring/${id}`, { active });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['recurring'] });
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const runRecurring = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/recurring/run');
      return data.created as number;
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries();
      toast.success(created ? `${created} due expense${created === 1 ? '' : 's'} created` : 'Nothing is due yet');
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const deleteRecurring = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/recurring/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['recurring'] });
      toast.success('Recurring expense removed');
      setDeleteRecurringId(null);
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const deleteAccount = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await api.delete(`/api/users/${user._id}`);
    },
    onSuccess: async () => {
      toast.success('Account deleted');
      await logout();
      navigate('/', { replace: true });
    },
    onError: (error) => toast.error(apiError(error)),
  });

  const categories = categoriesQuery.data || [];
  const recurring = recurringQuery.data || [];
  const emailAddress = emailCaptureQuery.data?.address || null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Your profile, appearance, custom categories, recurring expenses and account controls."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-primary" /> Profile
            </CardTitle>
            <CardDescription>This information is stored in MongoDB and shown to people in your groups.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={name} color={avatarColor} src={avatarUrl} size="xl" />
              <div className="flex flex-wrap gap-2">
                <input
                  ref={avatarInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadAvatar(file);
                  }}
                />
                <Button variant="outline" size="sm" onClick={() => avatarInput.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload picture
                </Button>
                {avatarUrl ? (
                  <Button variant="ghost" size="sm" onClick={() => setAvatarUrl('')}>
                    Remove picture
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatarColor(color)}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-card transition',
                    avatarColor === color ? 'ring-foreground/40' : 'ring-transparent',
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`Avatar colour ${color}`}
                >
                  {avatarColor === color ? <Check className="h-3.5 w-3.5 text-white" /> : null}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="settings-name">Full name</Label>
                <Input id="settings-name" className="mt-1.5" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="settings-email">Email</Label>
                <Input id="settings-email" type="email" className="mt-1.5" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="settings-upi">UPI ID (optional)</Label>
                <Input id="settings-upi" className="mt-1.5" placeholder="name@bank" value={upiId} onChange={(event) => setUpiId(event.target.value)} />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Used only to build a UPI deep link when you settle up. No payment is sent by SplitMate.
                </p>
              </div>
              <div>
                <Label>Default currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
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
              </div>
              <div>
                <Label htmlFor="settings-budget">Monthly budget (₹)</Label>
                <Input
                  id="settings-budget"
                  type="number"
                  min="0"
                  step="1"
                  className="mt-1.5"
                  placeholder="35000"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={saveProfile} disabled={saving || name.trim().length < 2 || !email.includes('@')} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save profile
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" /> Appearance
            </CardTitle>
            <CardDescription>Theme is saved to your local browser and account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {THEMES.map((entry) => (
              <button
                key={entry.value}
                type="button"
                onClick={() => chooseTheme(entry.value)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition',
                  theme === entry.value
                    ? 'border-primary/40 bg-primary/[0.05]'
                    : 'border-border/70 hover:bg-accent',
                )}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                  <entry.icon className="h-4 w-4" />
                </span>
                <span className="flex-1 text-sm font-medium">{entry.label}</span>
                {theme === entry.value ? <Check className="h-4 w-4 text-primary" /> : null}
              </button>
            ))}
            <div className="mt-3 rounded-xl bg-muted/40 p-3 text-[11px] text-muted-foreground">
              Currency, budget and profile fields are persisted on the server. Theme is stored both
              locally and in your account preference.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" /> Custom categories
              </CardTitle>
              <CardDescription>Personal categories appear in the expense form alongside defaults.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setCategoryOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          </CardHeader>
          <CardContent>
            {categoriesQuery.isLoading ? (
              <SkeletonRows rows={3} />
            ) : categories.length ? (
              <div className="space-y-1.5">
                {categories.map((category) => (
                  <div key={category._id} className="flex items-center gap-3 rounded-xl border border-border/60 p-2.5">
                    <CategoryIcon icon={category.icon} color={category.color} className="h-8 w-8 rounded-lg" />
                    <span className="flex-1 truncate text-sm font-medium">{category.name}</span>
                    {category.isDefault ? <Badge variant="outline">Default</Badge> : null}
                    {!category.isDefault ? (
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleteCategoryId(category._id)} title="Delete category">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Tag} title="No categories" description="Add a custom category to get started." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between pb-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-primary" /> Recurring expenses
              </CardTitle>
              <CardDescription>Schedules create expenses automatically while the server is running.</CardDescription>
            </div>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={() => runRecurring.mutate()} disabled={runRecurring.isPending}>
                <RefreshCcw className="h-3.5 w-3.5" /> Run due
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRecurringOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> New
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recurringQuery.isLoading ? (
              <SkeletonRows rows={3} />
            ) : recurring.length ? (
              <div className="space-y-1.5">
                {recurring.map((entry) => (
                  <div key={entry._id} className="flex items-center gap-3 rounded-xl border border-border/60 p-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Repeat className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{entry.description}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatMoney(entry.amountPaise)} · {entry.frequency.toLowerCase()} · next {formatDate(entry.nextRunAt)}
                      </p>
                    </div>
                    <Switch
                      checked={entry.active}
                      onCheckedChange={(active) => toggleRecurring.mutate({ id: entry._id, active })}
                      aria-label="Toggle recurring expense"
                    />
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleteRecurringId(entry._id)} title="Delete recurring">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Repeat}
                title="No recurring expenses"
                description="Schedule rent, subscriptions or allowances so they never get forgotten."
                action={
                  <Button size="sm" onClick={() => setRecurringOpen(true)}>
                    Schedule one
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" /> Automatic capture by email
          </CardTitle>
          <CardDescription>
            Forward bank alert emails to a private address and they become payments automatically — on
            iPhone and Android, with no app install.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailCaptureQuery.isLoading ? (
            <SkeletonRows rows={2} />
          ) : !emailCaptureQuery.data?.configured ? (
            <div className="rounded-xl border border-dashed border-border p-3">
              <p className="text-sm font-semibold">Not configured on this server</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Set <code className="font-mono">INBOUND_EMAIL_DOMAIN</code> and{' '}
                <code className="font-mono">INBOUND_EMAIL_SECRET</code> on the API, then point your email
                provider&apos;s inbound webhook at <code className="font-mono">/api/inbound/email</code>.
                The address appears here once both are set.
              </p>
            </div>
          ) : !emailAddress ? (
            <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Create your private address</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Only you know it. Forward bank transaction alerts to it and SplitMate logs them.
                </p>
              </div>
              <Button onClick={() => createEmailAddress.mutate()} disabled={createEmailAddress.isPending}>
                {createEmailAddress.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Inbox className="h-4 w-4" />
                )}
                Create my address
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/[0.04] p-3">
                <code className="min-w-0 flex-1 truncate font-mono text-sm">{emailAddress}</code>
                <Button variant="outline" size="sm" onClick={() => copyEmailAddress(emailAddress)}>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRotateEmailOpen(true)}>
                  <RefreshCcw className="h-3.5 w-3.5" /> Rotate
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDisableEmailOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Turn off
                </Button>
              </div>

              <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
                <li>
                  In Gmail: Settings → Forwarding and POP/IMAP → add a forwarding address and paste the
                  address above.
                </li>
                <li>Confirm the verification email Google forwards to it.</li>
                <li>
                  Create a filter for bank alerts (for example from hdfcbank.net or icicibank.com) and
                  forward them to that address.
                </li>
              </ol>

              <p className="rounded-xl bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
                Only transaction alerts are parsed. OTPs, marketing mail, statements, collect requests
                and failed payments are ignored, email bodies are not stored, and only you can see the
                captured payments.
              </p>

              <div>
                <p className="text-xs font-semibold">Recent auto-captures</p>
                {emailCapturesQuery.isLoading ? (
                  <SkeletonRows rows={2} />
                ) : emailCapturesQuery.data?.length ? (
                  <div className="mt-2 space-y-1.5">
                    {emailCapturesQuery.data.map((capture) => (
                      <div
                        key={capture._id}
                        className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2 text-xs"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {capture.status === 'CREATED' ? (
                            <>
                              {capture.payee || 'Payment'} · {formatMoney(capture.amountPaise || 0)}
                            </>
                          ) : capture.status === 'IGNORED' ? (
                            <>
                              Ignored ·{' '}
                              <span className="text-muted-foreground">
                                {capture.reason || 'not a transaction'}
                              </span>
                            </>
                          ) : (
                            capture.status.toLowerCase()
                          )}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            capture.status === 'CREATED'
                              ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                              : capture.status === 'FAILED'
                                ? 'border-rose-500/40 text-rose-600 dark:text-rose-400'
                                : 'text-muted-foreground'
                          }
                        >
                          {capture.status === 'CREATED'
                            ? 'Captured'
                            : capture.status === 'DUPLICATE'
                              ? 'Duplicate'
                              : capture.status === 'IGNORED'
                                ? 'Skipped'
                                : 'Error'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(capture.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">No emails received yet.</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" /> Automatic capture from bank SMS
          </CardTitle>
          <CardDescription>
            A web page can&apos;t read SMS, but your phone can forward each bank alert to SplitMate.
            Pick your phone below — every step shows a picture of the screen you should see. The phone
            reads the message; this web app just receives and parses it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {smsCaptureQuery.isLoading ? (
            <SkeletonRows rows={2} />
          ) : !smsCaptureQuery.data?.enabled ? (
            <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Create your SMS shortcut token</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  A private key you paste into the Shortcut once. It is shown only at creation, then
                  stored hashed.
                </p>
              </div>
              <Button onClick={() => createSmsToken.mutate()} disabled={createSmsToken.isPending}>
                {createSmsToken.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                Create token
              </Button>
            </div>
          ) : (
            <>
              {smsToken ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-3">
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    Copy this token now — it won&apos;t be shown again.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="min-w-0 flex-1 break-all font-mono text-xs">{smsToken}</code>
                    <Button variant="outline" size="sm" onClick={() => copySmsToken(smsToken)}>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">
                    Your token is active but hidden. Rotate it if you lost the Shortcut setup.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setRotateSmsOpen(true)}>
                    <RefreshCcw className="h-3.5 w-3.5" /> Rotate token
                  </Button>
                </div>
              )}

              <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold">URL to paste into Get Contents of URL</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Use this exact link in the action&apos;s URL field. Method must be POST.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={copyEndpoint}>
                    <Copy className="h-3.5 w-3.5" /> Copy URL
                  </Button>
                </div>
                <code className="mt-2 block break-all rounded-lg bg-background/60 px-2.5 py-2 font-mono text-xs">
                  {smsEndpoint}
                </code>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/[0.06] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">One-tap iPhone shortcut</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Download the ready-made Shortcut instead of adding the actions by hand. After
                    importing, open it and replace the token placeholder in Get Contents of URL, then
                    attach it to a Message automation.
                  </p>
                </div>
                <a
                  href="/shortcuts/splitmate-bank-sms-v2.shortcut"
                  download="SplitMate-Bank-SMS.shortcut"
                  className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}
                >
                  <Download className="h-4 w-4" /> Download Shortcut
                </a>
              </div>

              <SmsSetupGuide endpoint={smsEndpoint} />

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setRotateSmsOpen(true)}>
                  <RefreshCcw className="h-3.5 w-3.5" /> Rotate
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDisableSmsOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Turn off
                </Button>
                <span className="text-[10px] text-muted-foreground">
                  The endpoint must be reachable over HTTPS from your phone.
                </span>
              </div>

              <p className="rounded-xl bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
                Only transaction alerts are parsed. OTPs, failed payments and marketing SMS are ignored,
                full messages are not stored, and the token only writes to your account. If your bank
                sends both an email and an SMS, use one channel, not both, to avoid duplicate payments.
              </p>

              <div>
                <p className="text-xs font-semibold">Recent SMS captures</p>
                {smsCapturesQuery.isLoading ? (
                  <SkeletonRows rows={2} />
                ) : smsCapturesQuery.data?.length ? (
                  <div className="mt-2 space-y-1.5">
                    {smsCapturesQuery.data.map((capture) => (
                      <div
                        key={capture._id}
                        className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2 text-xs"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {capture.status === 'CREATED' ? (
                            <>
                              {capture.payee || 'Payment'} · {formatMoney(capture.amountPaise || 0)}
                            </>
                          ) : capture.status === 'IGNORED' ? (
                            <>
                              Ignored ·{' '}
                              <span className="text-muted-foreground">
                                {capture.reason || 'not a transaction'}
                              </span>
                            </>
                          ) : (
                            capture.status.toLowerCase()
                          )}
                        </span>
                        {capture.sender ? (
                          <span className="max-w-[90px] truncate text-[10px] text-muted-foreground">
                            {capture.sender}
                          </span>
                        ) : null}
                        <Badge
                          variant="outline"
                          className={
                            capture.status === 'CREATED'
                              ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                              : capture.status === 'FAILED'
                                ? 'border-rose-500/40 text-rose-600 dark:text-rose-400'
                                : 'text-muted-foreground'
                          }
                        >
                          {capture.status === 'CREATED'
                            ? 'Captured'
                            : capture.status === 'DUPLICATE'
                              ? 'Duplicate'
                              : capture.status === 'IGNORED'
                                ? 'Skipped'
                                : 'Error'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(capture.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">No SMS received yet.</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-rose-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-4 w-4" /> Danger zone
          </CardTitle>
          <CardDescription>
            Accounts with balances, expense history, payments or groups cannot be deleted until
            those are cleared. This is intentional — SplitMate never silently loses data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Deleting your account is permanent and signs you out immediately.
          </p>
          <Button variant="destructive" onClick={() => setDeleteAccountOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete my account
          </Button>
        </CardContent>
      </Card>

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
            <DialogDescription>This category is only visible to you.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="category-name">Name</Label>
              <Input id="category-name" className="mt-1.5" placeholder="Pet care" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
            </div>
            <div>
              <Label>Icon</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {CATEGORY_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setCategoryIcon(icon)}
                    className={cn(
                      'rounded-lg border p-1.5 transition',
                      categoryIcon === icon ? 'border-primary/50 bg-primary/10' : 'border-border hover:bg-accent',
                    )}
                    title={icon}
                  >
                    <CategoryIcon icon={icon} color={categoryColor} className="h-7 w-7 rounded-md" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Colour</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCategoryColor(color)}
                    className={cn('h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-card', categoryColor === color ? 'ring-foreground/40' : 'ring-transparent')}
                    style={{ backgroundColor: color }}
                    aria-label={`Colour ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryOpen(false)}>Cancel</Button>
            <Button onClick={() => createCategory.mutate()} disabled={categoryName.trim().length < 2 || createCategory.isPending}>
              Create category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recurringOpen} onOpenChange={setRecurringOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule recurring expense</DialogTitle>
            <DialogDescription>
              Creates an equal split among group members (or just you for a personal expense) on the
              chosen cadence.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="recurring-description">Description</Label>
              <Input id="recurring-description" className="mt-1.5" placeholder="Monthly rent" value={recurringDescription} onChange={(event) => setRecurringDescription(event.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="recurring-amount">Amount (₹)</Label>
                <Input id="recurring-amount" type="number" min="0" step="0.01" className="mt-1.5" value={recurringAmount} onChange={(event) => setRecurringAmount(event.target.value)} />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={recurringCategory} onValueChange={setRecurringCategory}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category._id} value={category._id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Group</Label>
                <Select value={recurringGroup} onValueChange={setRecurringGroup}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Just me (personal)</SelectItem>
                    {(groupsQuery.data || []).map((group) => (
                      <SelectItem key={group._id} value={group._id}>
                        {group.emoji} {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Frequency</Label>
                <Select value={recurringFrequency} onValueChange={(value) => setRecurringFrequency(value as 'WEEKLY' | 'MONTHLY')}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="recurring-start">First run</Label>
                <Input id="recurring-start" type="date" className="mt-1.5" value={recurringStart} onChange={(event) => setRecurringStart(event.target.value)} />
              </div>
            </div>
            <div className="rounded-xl bg-muted/40 p-3 text-[11px] text-muted-foreground">
              <CreditCard className="mr-1 inline h-3 w-3" />
              You are recorded as the payer. Group members share equally. Due runs are processed by a
              backend job or when you press “Run due”.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecurringOpen(false)}>Cancel</Button>
            <Button onClick={() => createRecurring.mutate()} disabled={createRecurring.isPending}>
              {createRecurring.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat className="h-4 w-4" />}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteCategoryId)}
        onOpenChange={(open) => !open && setDeleteCategoryId(null)}
        title="Delete this category?"
        description="Categories that are already used by expenses cannot be deleted."
        confirmLabel="Delete category"
        destructive
        onConfirm={async () => {
          if (deleteCategoryId) await deleteCategory.mutateAsync(deleteCategoryId);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteRecurringId)}
        onOpenChange={(open) => !open && setDeleteRecurringId(null)}
        title="Delete recurring expense?"
        description="Future runs stop immediately. Already-created expenses are kept."
        confirmLabel="Delete schedule"
        destructive
        onConfirm={async () => {
          if (deleteRecurringId) await deleteRecurring.mutateAsync(deleteRecurringId);
        }}
      />

      <ConfirmDialog
        open={rotateEmailOpen}
        onOpenChange={setRotateEmailOpen}
        title="Replace your forwarding address?"
        description="The old address stops working immediately. Update your email forwarding rule to keep capturing payments."
        confirmLabel="Create new address"
        onConfirm={async () => {
          await rotateEmailAddress.mutateAsync();
        }}
      />

      <ConfirmDialog
        open={disableEmailOpen}
        onOpenChange={setDisableEmailOpen}
        title="Turn off email capture?"
        description="Your forwarding address stops working immediately. Payments already captured stay in your history."
        confirmLabel="Turn off"
        destructive
        onConfirm={async () => {
          await disableEmailCapture.mutateAsync();
        }}
      />

      <ConfirmDialog
        open={rotateSmsOpen}
        onOpenChange={setRotateSmsOpen}
        title="Replace your SMS token?"
        description="The old token stops working immediately. Update the token inside your Shortcut to keep capturing payments."
        confirmLabel="Create new token"
        onConfirm={async () => {
          await rotateSmsToken.mutateAsync();
        }}
      />

      <ConfirmDialog
        open={disableSmsOpen}
        onOpenChange={setDisableSmsOpen}
        title="Turn off SMS capture?"
        description="The token stops working immediately and the Shortcut will get a 401. Payments already captured stay in your history."
        confirmLabel="Turn off"
        destructive
        onConfirm={async () => {
          await disableSmsCapture.mutateAsync();
        }}
      />

      <ConfirmDialog
        open={deleteAccountOpen}
        onOpenChange={setDeleteAccountOpen}
        title="Delete your account?"
        description="This permanently removes your profile. The server will refuse if you still have balances, payments, groups you created or expense history."
        confirmLabel="Delete account"
        destructive
        onConfirm={async () => {
          await deleteAccount.mutateAsync();
        }}
      />

      <Separator className="opacity-0" />
    </div>
  );
}
