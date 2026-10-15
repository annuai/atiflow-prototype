import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { canOpen, landingPath } from '@/features/access';
import { useAuth } from '@/features/auth/authStore';

/**
 * One guard for every signed-in page. Signed out -> /login. A page the user's access does not include (their role plus their own changes, see features/access)
 * sends them to the first page they can open. Which route needs which permission is declared in the access catalog, not on the routes.
 */
export function RequireAccess({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user);
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (!canOpen(user, loc.pathname)) return <Navigate to={landingPath(user)} replace />;
  return <>{children}</>;
}
