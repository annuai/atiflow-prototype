import { canOpen, landingPath } from '@/features/access';
import type { PublicUser } from '@/features/auth/types';

/** Remembers each user's last page so signing in again (or opening `/`) returns there. Stored per username; a page the user may no longer open is never restored. */
const key = (username: string) => `atiflow.lastPage.${username}`;
/** The builder URL of an unsaved workflow may not exist after a reload, so it is remembered as the workflow entry point. */
const normalize = (path: string) => (path.startsWith('/configurator/workflows/') ? '/configurator' : path);

export function rememberPage(user: PublicUser, path: string) {
  if (path === '/login' || !canOpen(user, normalize(path))) return;
  try { localStorage.setItem(key(user.username), normalize(path)); } catch { /* storage unavailable: nothing to remember */ }
}
export function landingFor(user: PublicUser): string {
  let remembered: string | null = null; try { remembered = localStorage.getItem(key(user.username)); } catch { /* ignore */ }
  return landingPath(user, remembered);
}
