import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

/**
 * Leak check: walk through the pages again and again and make sure nothing is left behind.
 *
 * A page that leaves a listener on `window` / `document` or a running interval behind keeps everything it captured alive for the rest of the session
 * (this is how every visit to the Live Floor once kept a whole 3D engine in memory). So we count what is registered, do one warm-up lap
 * (things that are registered once for the whole session are fine), then three more laps: the count must not grow.
 */
type Probe = { net: Record<string, number>; intervals: Set<number> };
declare global {
  interface Window {
    __leak: Probe;
  }
}

/** Runs in the page before the app starts: counts every listener that is added and not removed, and every interval that is started and not cleared. */
function installProbe() {
  const net: Record<string, number> = {};
  const intervals = new Set<number>();
  const track = (target: EventTarget, name: string) => {
    const add = target.addEventListener.bind(target);
    const remove = target.removeEventListener.bind(target);
    const live = new Map<unknown, Set<string>>();
    target.addEventListener = ((type: string, listener: unknown, options?: unknown) => {
      if (listener) {
        const key = `${name}:${type}`;
        const set = live.get(listener) ?? new Set<string>();
        if (!set.has(key)) {
          set.add(key);
          live.set(listener, set);
          net[key] = (net[key] ?? 0) + 1;
        }
      }
      return add(type, listener as EventListener, options as AddEventListenerOptions);
    }) as typeof target.addEventListener;
    target.removeEventListener = ((type: string, listener: unknown, options?: unknown) => {
      const key = `${name}:${type}`;
      if (listener && live.get(listener)?.delete(key)) net[key] = (net[key] ?? 0) - 1;
      return remove(type, listener as EventListener, options as EventListenerOptions);
    }) as typeof target.removeEventListener;
  };
  track(window, 'window');
  track(document, 'document');
  const setI = window.setInterval.bind(window);
  const clearI = window.clearInterval.bind(window);
  window.setInterval = ((...a: Parameters<typeof setInterval>) => {
    const id = setI(...a) as unknown as number;
    intervals.add(id);
    return id;
  }) as typeof window.setInterval;
  window.clearInterval = ((id?: number) => {
    if (id !== undefined) intervals.delete(id);
    return clearI(id);
  }) as typeof window.clearInterval;
  window.__leak = { net, intervals };
}

const snapshot = (page: Page) =>
  page.evaluate(() => ({ net: { ...window.__leak.net }, intervals: window.__leak.intervals.size }));

/** Go to a page inside the running app (no reload: the app's own router does it, like a click on a link). */
async function visit(page: Page, path: string) {
  await page.evaluate((p) => {
    history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForURL((u) => u.pathname === path.split('?')[0]);
  await page.waitForTimeout(700); // the page's own exit animation, lazy loading and clean-up
}

async function laps(page: Page, pages: string[]) {
  for (const p of pages) await visit(page, p); // warm-up lap: one-off registrations are not leaks
  const before = await snapshot(page);
  for (let lap = 0; lap < 3; lap++) for (const p of pages) await visit(page, p);
  const after = await snapshot(page);
  const drift = Object.fromEntries(
    Object.keys({ ...before.net, ...after.net })
      .map((k) => [k, (after.net[k] ?? 0) - (before.net[k] ?? 0)] as const)
      .filter(([, d]) => d !== 0),
  );
  return { drift, intervals: after.intervals - before.intervals };
}

test.describe('no leaks when pages are opened again and again', () => {
  test.setTimeout(180_000);

  test('supervisor pages (incl. the 3D Live Floor)', async ({ page }) => {
    await page.addInitScript(installProbe);
    await signIn(page, 'arjun');
    const result = await laps(page, [
      '/supervisor/livefloor',
      '/supervisor/dashboard',
      '/supervisor/reports',
      '/supervisor/action-center',
      '/supervisor/notifications',
      '/supervisor/settings',
    ]);
    expect(result.drift, 'listeners left on window / document').toEqual({});
    expect(result.intervals, 'intervals left running').toBe(0);
    await visit(page, '/supervisor/dashboard');
    await expect(page.locator('canvas')).toHaveCount(0); // the 3D view and its WebGL context are gone
  });

  test('configurator pages (incl. the Map Editor and the 3D map)', async ({ page }) => {
    await page.addInitScript(installProbe);
    await signIn(page, 'meera');
    const result = await laps(page, [
      '/configurator/robots',
      '/configurator/maps',
      '/configurator/maps/main-assembly',
      '/configurator/maps/main-assembly/3d',
      '/configurator/master-data/materials',
      '/configurator/fleets',
      '/configurator/settings',
      '/configurator/users',
    ]);
    expect(result.drift, 'listeners left on window / document').toEqual({});
    expect(result.intervals, 'intervals left running').toBe(0);
    await visit(page, '/configurator/robots');
    await expect(page.locator('canvas')).toHaveCount(0);
  });
});
