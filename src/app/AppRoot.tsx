import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/authStore';
import { LoginPage } from '@/features/auth/LoginPage';
import { LiveFloorPage } from '@/features/live-floor/LiveFloorPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { DashboardNewPage } from '@/features/dashboard-new/DashboardNewPage';
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
import { RequireRole } from './guards';
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

/** Route table: one public route (/login) and one page per role. Add a role = add a route + entry in roles.ts. */
export function AppRoot() {
  return (
    <BrowserRouter>
     <NotificationsProvider api={notificationApi}>
      <AppToaster />
      <PageMemory />
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/supervisor" element={<RequireRole role="supervisor"><RootRedirect /></RequireRole>} />
        <Route path="/supervisor/dashboard" element={<RequireRole role="supervisor"><DashboardPage /></RequireRole>} />
        <Route path="/supervisor/dashboard-new" element={<RequireRole role="supervisor"><DashboardNewPage /></RequireRole>} />
        <Route path="/supervisor/notifications" element={<RequireRole role="supervisor"><NotificationsPage /></RequireRole>} />
        <Route path="/supervisor/livefloor" element={<RequireRole role="supervisor"><LiveFloorPage /></RequireRole>} />
        <Route path="/configurator" element={<RequireRole role="configurator"><NewWorkflow /></RequireRole>} />
        <Route path="/configurator/workflows/:id" element={<RequireRole role="configurator"><WorkflowBuilderPage /></RequireRole>} />
        {(['robot', 'hardware'] as const).map((k) => (
          <Route key={k} path={`/configurator/${KINDS[k].route}`}>
            <Route index element={<RequireRole role="configurator"><DeviceListPage kind={KINDS[k]} /></RequireRole>} />
            <Route path=":name" element={<RequireRole role="configurator"><DeviceDetailPage kind={KINDS[k]} /></RequireRole>} />
          </Route>
        ))}
        <Route path="/configurator/master-data/:tab?" element={<RequireRole role="configurator"><MasterDataPage /></RequireRole>} />
        <Route path="/configurator/fleets/:name/:tab?" element={<RequireRole role="configurator"><FleetPage /></RequireRole>} />
        <Route path="/configurator/notifications" element={<RequireRole role="configurator"><NotificationsPage /></RequireRole>} />
        <Route path="/configurator/maps" element={<RequireRole role="configurator"><MapsPage /></RequireRole>} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
     </NotificationsProvider>
    </BrowserRouter>
  );
}
