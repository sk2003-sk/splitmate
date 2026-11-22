import { useEffect } from 'react';
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  type Location,
} from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PublicShell } from '@/components/public/public-shell';
import { useAuth } from '@/context/auth';
import PublicHomePage from '@/pages/public/home';
import PublicSplitsPage from '@/pages/public/splits';
import PublicSplitNewPage from '@/pages/public/split-new';
import PublicSplitDetailPage from '@/pages/public/split-detail';
import LoginPage from '@/pages/login';
import RegisterPage from '@/pages/register';
import DashboardPage from '@/pages/dashboard';
import ExpensesPage from '@/pages/expenses';
import ExpenseNewPage from '@/pages/expense-new';
import ExpenseDetailPage from '@/pages/expense-detail';
import BalancesPage from '@/pages/balances';
import SettlementsPage from '@/pages/settlements';
import PaymentsPage from '@/pages/payments';
import GroupsPage from '@/pages/groups';
import GroupDetailPage from '@/pages/group-detail';
import AnalyticsPage from '@/pages/analytics';
import ActivityPage from '@/pages/activity';
import NotificationsPage from '@/pages/notifications';
import MembersPage from '@/pages/members';
import SettingsPage from '@/pages/settings';
import ProfilePage from '@/pages/profile';
import NotFoundPage from '@/pages/not-found';

function FullPageLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading SplitMate…</p>
    </div>
  );
}

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/" replace state={{ from: location }} />;
  return <Outlet />;
}

function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicShell />}>
          <Route index element={<PublicHomePage />} />
          <Route path="splits" element={<PublicSplitsPage />} />
          <Route path="split/new" element={<PublicSplitNewPage />} />
          <Route path="split/:code" element={<PublicSplitDetailPage />} />
        </Route>

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="expenses/new" element={<ExpenseNewPage />} />
            <Route path="expenses/:id" element={<ExpenseDetailPage />} />
            <Route path="balances" element={<BalancesPage />} />
            <Route path="settlements" element={<SettlementsPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="groups/:id" element={<GroupDetailPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
