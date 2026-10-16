import { can, canOpen, workspaceOfPath } from '@/features/access';
import { authStore, visibleLiveIds } from '@/features/auth';
import { settingsStore } from '@/features/settings';
import { getLocale } from '@/i18n/store';
import type { SearchContext } from './types';

/** Who is searching, right now: the signed-in person, what they may do, which fleets they see, where they are. Built fresh for every search so a permission change applies at once. */
export function buildSearchContext(): SearchContext | null {
  const user = authStore.getState().user;
  if (!user) return null;
  return {
    user,
    key: `${user.username}|${user.role}|${JSON.stringify(user.custom ?? null)}|${[...(visibleLiveIds() ?? ['*'])].sort().join(',')}`,
    can: (perm) => can(user, perm),
    canOpen: (path) => canOpen(user, path),
    liveFleets: visibleLiveIds(),
    workspace: workspaceOfPath(typeof location === 'undefined' ? '' : location.pathname),
    locale: getLocale(),
    site: settingsStore.getState().general.siteName,
    now: Date.now(),
  };
}
