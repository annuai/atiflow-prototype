import { USERS_PATH, WORKSPACES } from '@/features/access';
import { localized } from '@/i18n';

/** The product name: never translated. */
const BRAND = 'Ati Flow';
const names = localized('nav');
const auth = localized('auth');
const floor = localized('floor');

const matches = (path: string, rule: string) =>
  rule.endsWith('$') ? path === rule.slice(0, -1) : path === rule || path.startsWith(rule + '/');

/**
 * The browser tab title of a page, in the language in use: `<page> · Ati Flow`, or `<name> · <page> · Ati Flow` when the page shows one named thing (a robot, a fleet, a user, a map, a workflow): the PAGE gives that name with `<PageTitleName name=... />`, nothing is listed here.
 * The page name is the feature's name from the access catalog (the same word as in the sidebar), so a new page needs no title of its own as long as it is a feature.
 */
export function pageTitle(pathname: string, name?: string | null): string {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  let page: string | null = null;
  if (path === '/login') page = auth.logIn;
  else if (path === '/no-access') page = floor.noAccess.title;
  else if (matches(path, USERS_PATH)) page = names.items.users;
  else if (WORKSPACES.some((w) => w.shared.some((s) => matches(path, s)))) page = names.items.notifications;
  else
    for (const w of WORKSPACES) {
      const f = w.features.find((x) => x.routes.some((r) => matches(path, r)));
      if (f) {
        page = f.label;
        break;
      }
    }
  if (!page) return BRAND;
  return [name, page, BRAND].filter(Boolean).join(' · ');
}
