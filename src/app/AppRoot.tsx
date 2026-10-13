import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/authStore';
import { LoginPage } from '@/features/auth/LoginPage';
import { LiveFloorPage } from '@/features/live-floor/LiveFloorPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { DashboardNewPage } from '@/features/dashboard-new/DashboardNewPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { DeviceDetailPage } from '@/features/devices/DeviceDetailPage';
import { DeviceListPage } from '@/features/devices/DeviceListPage';
import { MapsPage } from '@/features/maps/MapsPage';
import { FleetPage } from '@/features/fleets/FleetPage';
import { KINDS } from '@/features/devices/model/kinds';
import { MasterDataPage } from '@/features/master-data/MasterDataPage';
import { WorkflowBuilderPage } from '@/features/workflow-builder/WorkflowBuilderPage';
import { wfStore } from '@/features/workflow-builder/model/store';
import { notificationApi } from '@/features/notifications';
import { NotificationsProvider } from '@/features/notifications/NotificationsProvider';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { AppToaster } from '@/ui/toast';
import { UserDetailPage } from '@/features/users/UserDetailPage';
import { UsersPage } from '@/features/users/UsersPage';
import { NoAccessPage } from '@/features/access/NoAccessPage';
import { RequireAccess } from './guards';
import { landingFor, rememberPage } from './lastPage';

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
        <Route path="/supervisor/dashboard" element={<RequireAccess><DashboardPage /></RequireAccess>} />
        <Route path="/supervisor/reports" element={<RequireAccess><ReportsPage /></RequireAccess>} />
        <Route path="/supervisor/dashboard-new" element={<RequireAccess><DashboardNewPage /></RequireAccess>} />
        <Route path="/supervisor/notifications" element={<RequireAccess><NotificationsPage /></RequireAccess>} />
        <Route path="/supervisor/livefloor" element={<RequireAccess><LiveFloorPage /></RequireAccess>} />
        <Route path="/configurator" element={<RequireAccess><NewWorkflow /></RequireAccess>} />
        <Route path="/configurator/workflows/:id" element={<RequireAccess><WorkflowBuilderPage /></RequireAccess>} />
        {(['robot', 'hardware'] as const).map((k) => (
          <Route key={k} path={`/configurator/${KINDS[k].route}`}>
            <Route index element={<RequireAccess><DeviceListPage kind={KINDS[k]} /></RequireAccess>} />
            <Route path=":name" element={<RequireAccess><DeviceDetailPage kind={KINDS[k]} /></RequireAccess>} />
          </Route>
        ))}
        <Route path="/configurator/master-data/:tab?" element={<RequireAccess><MasterDataPage /></RequireAccess>} />
        <Route path="/configurator/fleets/:name/:tab?" element={<RequireAccess><FleetPage /></RequireAccess>} />
        <Route path="/configurator/notifications" element={<RequireAccess><NotificationsPage /></RequireAccess>} />
        <Route path="/configurator/users" element={<RequireAccess><UsersPage /></RequireAccess>} />
        <Route path="/configurator/users/:username" element={<RequireAccess><UserDetailPage /></RequireAccess>} />
        <Route path="/no-access" element={<NoAccessPage />} />
        <Route path="/configurator/maps" element={<RequireAccess><MapsPage /></RequireAccess>} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
     </NotificationsProvider>
    </BrowserRouter>
  );
}
