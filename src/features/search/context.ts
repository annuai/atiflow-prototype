import { can, canOpen, workspaceOfPath } from '@/features/access';
import { authStore, visibleLiveIds } from '@/features/auth';
import { settingsStore } from '@/features/settings';
import { getLocale } from '@/i18n/store';
import type { SearchContext } from './types';

/** Who is searching, right now: the signed-in person, what they may do, which fleets they see, where they are. Built fresh for every search so a permission change applies at once. */
export function buildSearchContext(): SearchContext | null {
  const user = authStore.getState().user;
  if (!user) return null;
  const workspace = workspaceOfPath(typeof location === 'undefined' ? '' : location.pathname);
  // Search covers the open workspace only, even for a person who may enter another: a permission of another workspace counts as not held here, a page of another workspace is not offered
  const inWorkspace = (perm: string) => !workspace || perm.startsWith(`${workspace}.`);
  return {
    user,
    key: `${user.username}|${user.role}|${JSON.stringify(user.custom ?? null)}|${[...(visibleLiveIds() ?? ['*'])].sort().join(',')}|${workspace ?? ''}`,
    can: (perm) => inWorkspace(perm) && can(user, perm),
    canOpen: (path) => (!workspace || workspaceOfPath(path) === workspace) && canOpen(user, path),
    liveFleets: visibleLiveIds(),
    workspace,
    locale: getLocale(),
    site: settingsStore.getState().general.siteName,
    now: Date.now(),
  };
}
