import { useEffect, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { pageTitle } from './documentTitle';

/** The name the open page shows (a robot, a fleet...), given by the page itself. Data: never translated. */
let current: string | null = null;
const listeners = new Set<() => void>();
const set = (name: string | null) => {
  current = name;
  listeners.forEach((l) => l());
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/**
 * Keeps the browser tab title in step with the page and the language: `<page> · Ati Flow`, with the page's own name in front when it gives one (see `PageTitleName`).
 * Mount once, inside the router (the app re-mounts it when the language changes). Renders nothing.
 */
export function PageTitle() {
  const { pathname } = useLocation();
  const name = useSyncExternalStore(subscribe, () => current);
  useEffect(() => {
    document.title = pageTitle(pathname, name);
  }, [pathname, name]);
  return null;
}

/** Put in a page that shows ONE named thing: `<PageTitleName name={robot.name} />` adds the name to the tab title for as long as the page is open. Renders nothing. */
export function PageTitleName({ name }: { name?: string | null }) {
  useEffect(() => {
    set(name || null);
    return () => set(null);
  }, [name]);
  return null;
}
