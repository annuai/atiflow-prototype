import { canManageUsers, can, type PermissionId } from '@/features/access';
import { authStore, useAuth } from './authStore';

/** What the signed-in user may do, for components (re-renders when their role or access changes). Lives in `auth` (not `access`) because it reads the signed-in user: `access` stays pure policy. */
export function useAccess() {
  const user = useAuth((s) => s.user);
  return {
    user,
    can: (perm: PermissionId) => !!user && can(user, perm),
    canManageUsers: !!user && canManageUsers(user),
  };
}
/** The same for code outside React (search hits, event handlers). */
export const canNow = (perm: PermissionId) => {
  const u = authStore.getState().user;
  return !!u && can(u, perm);
};
