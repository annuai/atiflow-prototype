import { lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/authStore';
import { LoginPage } from '@/features/auth/LoginPage';
import { KINDS } from '@/features/devices/model/kinds';
import { wfStore } from '@/features/workflow-builder/model/store';
import { notificationApi } from '@/features/notifications';
import { NotificationsProvider } from '@/features/notifications/NotificationsProvider';
import { AppToaster } from '@/ui/toast';
import { NoAccessPage } from '@/features/access/NoAccessPage';
import { ShellLayout } from '@/shell/ShellLayout';
import { RequireAccess } from './guards';
import { landingFor, rememberPage } from './lastPage';

/** Every page is loaded the first time it is opened (the 3D Live Floor and its libraries only when someone goes there); `PageTransition` shows a skeleton meanwhile. */
const LiveFloorPage = lazy(() => import('@/features/live-floor/LiveFloorPage').then((m) => ({ default: m.LiveFloorPage })));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ActionCenterPage = lazy(() => import('@/features/action-center/ActionCenterPage').then((m) => ({ default: m.ActionCenterPage })));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const DeviceDetailPage = lazy(() => import('@/features/devices/DeviceDetailPage').then((m) => ({ default: m.DeviceDetailPage })));
const DeviceListPage = lazy(() => import('@/features/devices/DeviceListPage').then((m) => ({ default: m.DeviceListPage })));
const MapsPage = lazy(() => import('@/features/maps/MapsPage').then((m) => ({ default: m.MapsPage })));
const FleetPage = lazy(() => import('@/features/fleets/FleetPage').then((m) => ({ default: m.FleetPage })));
const MasterDataPage = lazy(() => import('@/features/master-data/MasterDataPage').then((m) => ({ default: m.MasterDataPage })));
const WorkflowBuilderPage = lazy(() => import('@/features/workflow-builder/WorkflowBuilderPage').then((m) => ({ default: m.WorkflowBuilderPage })));
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const UserDetailPage = lazy(() => import('@/features/users/UserDetailPage').then((m) => ({ default: m.UserDetailPage })));
const UsersPage = lazy(() => import('@/features/users/UsersPage').then((m) => ({ default: m.UsersPage })));
const RequestPage = lazy(() => import('@/features/requests/RequestPage').then((m) => ({ default: m.RequestPage })));
const ApprovePage = lazy(() => import('@/features/requests/ApprovePage').then((m) => ({ default: m.ApprovePage })));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const PreferencesPage = lazy(() => import('@/features/preferences/PreferencesPage').then((m) => ({ default: m.PreferencesPage })));

function LoginRoute() {
  const user = useAuth((s) => s.user); const navigate = useNavigate();
  if (user) return <Navigate to={landingFor(user)} replace />;       // already signed in
  return <LoginPage onAuthenticated={(u) => navigate(landingFor(u), { replace: true })} />;
}
/** "Workflows" in the sidebar: opens a new workflow (fleet not chosen yet) and shows it at its own URL. */
function NewWorkflow() {
  const navigate = useNavigate();
  useEffect(() => { navigate(`/configurator/workflows/${wfStore.getState().startWorkflow()}`, { replace: true }); }, [navigate]);
  return null;
}
/** Saves the signed-in user's current page; signed out (e.g. just logged out) saves nothing, so the page they left stays remembered. */
function PageMemory() {
  const user = useAuth((s) => s.user); const { pathname } = useLocation();
  useEffect(() => { if (user) rememberPage(user, pathname); }, [user, pathname]);
  return null;
}
/** A page that moved: keeps the query (e.g. `?tv=1` of a wall display's bookmark). */
function MovedTo({ to }: { to: string }) { const { search } = useLocation(); return <Navigate to={to + search} replace />; }
function RootRedirect() { const user = useAuth((s) => s.user); return <Navigate to={user ? landingFor(user) : '/login'} replace />; }

/** Route table: one public route (/login) and every other page behind one guard. What a user may open comes from the access catalog (features/access), not from the routes. */
export function AppRoot() {
  return (
    <BrowserRouter>
     <NotificationsProvider api={notificationApi}>
      <AppToaster />
      <PageMemory />
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/supervisor" element={<RootRedirect />} />
        <Route path="/operator" element={<RootRedirect />} />
        <Route path="/supervisor/dashboard-new" element={<MovedTo to="/supervisor/dashboard" />} />
        {/* one persistent frame (sidebar + top bar) per workspace; the pages below render inside its content area */}
        <Route element={<RequireAccess><ShellLayout workspace="supervisor" /></RequireAccess>}>
          <Route path="/supervisor/dashboard" element={<DashboardPage />} />
          <Route path="/supervisor/reports" element={<ReportsPage />} />
          <Route path="/supervisor/notifications" element={<NotificationsPage />} />
          <Route path="/supervisor/action-center" element={<ActionCenterPage />} />
          <Route path="/supervisor/livefloor" element={<LiveFloorPage />} />
          <Route path="/supervisor/settings/:tab?" element={<PreferencesPage />} />
        </Route>
        <Route element={<RequireAccess><ShellLayout workspace="operator" /></RequireAccess>}>
          <Route path="/operator/request" element={<RequestPage />} />
          <Route path="/operator/approve" element={<ApprovePage />} />
          <Route path="/operator/action-center" element={<ActionCenterPage />} />
          <Route path="/operator/notifications" element={<NotificationsPage />} />
        </Route>
        <Route element={<RequireAccess><ShellLayout workspace="configurator" /></RequireAccess>}>
          <Route path="/configurator" element={<NewWorkflow />} />
          <Route path="/configurator/workflows/:id" element={<WorkflowBuilderPage />} />
          {(['robot', 'hardware'] as const).map((k) => (
            <Route key={k} path={`/configurator/${KINDS[k].route}`}>
              <Route index element={<DeviceListPage kind={KINDS[k]} />} />
              <Route path=":name" element={<DeviceDetailPage kind={KINDS[k]} />} />
            </Route>
          ))}
          <Route path="/configurator/master-data/:tab?" element={<MasterDataPage />} />
          <Route path="/configurator/fleets/:name/:tab?" element={<FleetPage />} />
          <Route path="/configurator/notifications" element={<NotificationsPage />} />
          <Route path="/configurator/users" element={<UsersPage />} />
          <Route path="/configurator/users/:username" element={<UserDetailPage />} />
          <Route path="/configurator/settings/:tab?" element={<SettingsPage />} />
          <Route path="/configurator/maps" element={<MapsPage />} />
        </Route>
        <Route path="/no-access" element={<NoAccessPage />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
     </NotificationsProvider>
    </BrowserRouter>
  );
}
