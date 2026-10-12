import type { PublicUser } from '@/features/auth/types';
import { ROLES, homeFor } from './roles';

/** Remembers each user's last page so signing in again (or opening `/`) returns there. Stored per username; a page of another role is never restored. */
const key = (username: string) => `atiflow.lastPage.${username}`;
/** The builder URL of an unsaved workflow may not exist after a reload, so it is remembered as the workflow entry point. */
const normalize = (path: string) => (path.startsWith('/configurator/workflows/') ? '/configurator' : path);
const belongsTo = (path: string, user: PublicUser) => path === ROLES[user.role].home || path.startsWith(`/${user.role}/`) || path === `/${user.role}`;

export function rememberPage(user: PublicUser, path: string) {
  if (path === '/login' || path === `/${user.role}` || !belongsTo(normalize(path), user)) return;     // (the bare role url only redirects)
  try { localStorage.setItem(key(user.username), normalize(path)); } catch { /* storage unavailable: nothing to remember */ }
}
export function landingFor(user: PublicUser): string {
  try { const p = localStorage.getItem(key(user.username)); if (p && belongsTo(p, user)) return p; } catch { /* ignore */ }
  return homeFor(user.role);
}
