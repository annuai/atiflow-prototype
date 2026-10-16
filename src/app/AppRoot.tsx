import { lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { authStore, useAuth } from '@/features/auth/authStore';
import { metrics, setRuntimeContext } from '@/platform';
import { pageKey } from '@/shell/pageKey';
import { LoginPage } from '@/features/auth/LoginPage';
import { KINDS } from '@/features/devices/model/kinds';
import { wfStore } from '@/features/workflow-builder/model/store';
import { notificationApi } from '@/features/notifications/notificationApi';
import { NotificationsProvider } from '@/features/notifications/NotificationsProvider';
import { PersistenceNotice } from '@/shell/PersistenceNotice';
import { LocaleBoundary } from '@/i18n';
import { LocaleSync } from './LocaleSync';
import { PageTitle } from '@/shell/PageTitle';
import { AppToaster } from '@/ui/toast';
import { NoAccessPage } from '@/features/access/NoAccessPage';
import { ShellLayout } from '@/shell/ShellLayout';
import { RequireAccess } from './guards';
import { landingFor, rememberPage } from './lastPage';

/** Every page is loaded the first time it is opened (the 3D Live Floor and its libraries only when someone goes there); `PageTransition` shows a skeleton meanwhile. */
const LiveFloorPage = lazy(() =>
  import('@/features/live-floor/LiveFloorPage').then((m) => ({ default: m.LiveFloorPage })),
);
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const ActionCenterPage = lazy(() =>
  import('@/features/action-center/ActionCenterPage').then((m) => ({ default: m.ActionCenterPage })),
);
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const DeviceDetailPage = lazy(() =>
  import('@/features/devices/DeviceDetailPage').then((m) => ({ default: m.DeviceDetailPage })),
);
const DeviceListPage = lazy(() =>
  import('@/features/devices/DeviceListPage').then((m) => ({ default: m.DeviceListPage })),
);
const MapsPage = lazy(() => import('@/features/maps/MapsPage').then((m) => ({ default: m.MapsPage })));
const FleetsIndexPage = lazy(() =>
  import('@/features/fleets/FleetsIndexPage').then((m) => ({ default: m.FleetsIndexPage })),
);
const FleetPage = lazy(() => import('@/features/fleets/FleetPage').then((m) => ({ default: m.FleetPage })));
const MasterDataPage = lazy(() =>
  import('@/features/master-data/MasterDataPage').then((m) => ({ default: m.MasterDataPage })),
);
const WorkflowBuilderPage = lazy(() =>
  import('@/features/workflow-builder/WorkflowBuilderPage').then((m) => ({ default: m.WorkflowBuilderPage })),
);
const NotificationsPage = lazy(() =>
  import('@/features/notifications/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const UserDetailPage = lazy(() =>
  import('@/features/users/UserDetailPage').then((m) => ({ default: m.UserDetailPage })),
);
const UsersPage = lazy(() => import('@/features/users/UsersPage').then((m) => ({ default: m.UsersPage })));
const BookTripPage = lazy(() => import('@/features/bookings/BookTripPage').then((m) => ({ default: m.BookTripPage })));
const OperatorHistoryPage = lazy(() =>
  import('@/features/operator-history/OperatorHistoryPage').then((m) => ({ default: m.OperatorHistoryPage })),
);
const ApprovePage = lazy(() => import('@/features/requests/ApprovePage').then((m) => ({ default: m.ApprovePage })));
const MapEditorPage = lazy(() =>
  import('@/features/map-editor/MapEditorPage').then((m) => ({ default: m.MapEditorPage })),
);
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const PreferencesPage = lazy(() =>
  import('@/features/preferences/PreferencesPage').then((m) => ({ default: m.PreferencesPage })),
);

function LoginRoute() {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  if (user) return <Navigate to={landingFor(user)} replace />; // already signed in
  return <LoginPage onAuthenticated={(u) => navigate(landingFor(u), { replace: true })} />;
}
/** "Workflows" in the sidebar: opens a new workflow (fleet not chosen yet) and shows it at its own URL. */
function NewWorkflow() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/configurator/workflows/${wfStore.getState().startWorkflow()}`, { replace: true });
  }, [navigate]);
  return null;
}
/** Saves the signed-in user's current page; signed out (e.g. just logged out) saves nothing, so the page they left stays remembered. */
function PageMemory() {
  const user = useAuth((s) => s.user);
  const { pathname } = useLocation();
  useEffect(() => {
    if (user) rememberPage(user, pathname);
  }, [user, pathname]);
  return null;
}
// every log line, error report and metric carries who was signed in
setRuntimeContext(() => ({ user: authStore.getState().user?.username }));
/** Counts page views (tabs inside a page are the same page, like for the page transition). */
function PageViews() {
  const { pathname } = useLocation();
  useEffect(() => metrics.track('page_view', { path: pageKey(pathname) }), [pathname]);
  return null;
}
/** A page that moved: keeps the query (e.g. `?tv=1` of a wall display's bookmark). */
function MovedTo({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={to + search} replace />;
}
/** The old Request page: material requests are a tab of Book trip now, and the old "request history" link goes to the consolidated History. */
function MovedRequest() {
  const { search } = useLocation();
  return (
    <Navigate
      to={new URLSearchParams(search).get('tab') === 'history' ? '/operator/history' : '/operator/book'}
      replace
    />
  );
}
function RootRedirect() {
  const user = useAuth((s) => s.user);
  return <Navigate to={user ? landingFor(user) : '/login'} replace />;
}

/** Route table: one public route (/login) and every other page behind one guard. What a user may open comes from the access catalog (features/access), not from the routes. */
export function AppRoot() {
  return (
    <BrowserRouter>
      <NotificationsProvider api={notificationApi}>
        <LocaleSync />
        <LocaleBoundary>
          <AppToaster />
          <PersistenceNotice />
          <PageMemory />
          <PageViews />
          <PageTitle />
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/supervisor" element={<RootRedirect />} />
            <Route path="/operator" element={<RootRedirect />} />
            <Route path="/supervisor/dashboard-new" element={<MovedTo to="/supervisor/dashboard" />} />
            {/* one persistent frame (sidebar + top bar) per workspace; the pages below render inside its content area */}
            <Route
              element={
                <RequireAccess>
                  <ShellLayout workspace="supervisor" />
                </RequireAccess>
              }
            >
              <Route path="/supervisor/dashboard" element={<DashboardPage />} />
              <Route path="/supervisor/reports" element={<ReportsPage />} />
              <Route path="/supervisor/notifications" element={<NotificationsPage />} />
              <Route path="/supervisor/action-center" element={<ActionCenterPage />} />
              <Route path="/supervisor/livefloor" element={<LiveFloorPage />} />
              <Route path="/supervisor/settings/:tab?" element={<PreferencesPage />} />
            </Route>
            <Route
              element={
                <RequireAccess>
                  <ShellLayout workspace="operator" />
                </RequireAccess>
              }
            >
              <Route path="/operator/request" element={<MovedRequest />} />
              <Route path="/operator/book" element={<BookTripPage />} />
              <Route path="/operator/approve" element={<ApprovePage />} />
              <Route path="/operator/history" element={<OperatorHistoryPage />} />
              <Route path="/operator/action-center" element={<ActionCenterPage />} />
              <Route path="/operator/notifications" element={<NotificationsPage />} />
              <Route path="/operator/settings/:tab?" element={<PreferencesPage />} />
            </Route>
            <Route
              element={
                <RequireAccess>
                  <ShellLayout workspace="configurator" />
                </RequireAccess>
              }
            >
              <Route path="/configurator" element={<NewWorkflow />} />
              <Route path="/configurator/workflows/:id" element={<WorkflowBuilderPage />} />
              {(['robot', 'hardware'] as const).map((k) => (
                <Route key={k} path={`/configurator/${KINDS[k].route}`}>
                  <Route index element={<DeviceListPage kind={KINDS[k]} />} />
                  <Route path=":name" element={<DeviceDetailPage kind={KINDS[k]} />} />
                </Route>
              ))}
              <Route path="/configurator/master-data/:tab?" element={<MasterDataPage />} />
              <Route path="/configurator/fleets" element={<FleetsIndexPage />} />
              <Route path="/configurator/fleets/:name/:tab?" element={<FleetPage />} />
              <Route path="/configurator/notifications" element={<NotificationsPage />} />
              <Route path="/configurator/users" element={<UsersPage />} />
              <Route path="/configurator/users/:username" element={<UserDetailPage />} />
              <Route path="/configurator/settings/:tab?" element={<SettingsPage />} />
              <Route path="/configurator/maps" element={<MapsPage />} />
              <Route path="/configurator/maps/:id" element={<MapEditorPage />} />
            </Route>
            <Route path="/no-access" element={<NoAccessPage />} />
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </LocaleBoundary>
      </NotificationsProvider>
    </BrowserRouter>
  );
}
