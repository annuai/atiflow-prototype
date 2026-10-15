import { describe, expect, it } from 'vitest';
import { MAX_NOTIFICATIONS, NotificationCenter } from '../src/features/notifications/center';
import { RobotAlertWatcher, STUCK_AFTER_S } from '../src/features/notifications/robotAlerts';
import { mesBackfill, mesNext } from '../src/features/notifications/mesSource';
import { SOURCES } from '../src/features/notifications/sources';
import { timeAgo } from '../src/features/notifications/copy';
import { localApi, restApi } from '../src/features/notifications/api';
import { createNotificationStore } from '../src/features/notifications/store';
import type { AppNotification, NewNotification, NotificationApi } from '../src/features/notifications/types';
import type { PublicUser } from '../src/features/auth/types';
import type { RobotTelemetry } from '../src/core/types';

const n = (id: string, at: number): NewNotification => ({ id, kind: 'mes', level: 'info', title: id, at });
const bot = (o: Partial<RobotTelemetry>): RobotTelemetry => ({
  id: 'AMR-001',
  model: 'm',
  fleetId: 'f1',
  siteId: 's',
  pose: { x: 0, y: 0, theta: 0 },
  speed: 0,
  state: 'moving',
  battery: 80,
  ts: 0,
  ...o,
});

describe('notification center', () => {
  it('keeps the newest first, ignores duplicates and starts everything unread', () => {
    const c = new NotificationCenter();
    expect(c.add([n('a', 1), n('b', 3), n('c', 2)])).toBe(3);
    expect(c.items.map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect(c.add([n('a', 1), n('d', 4)])).toBe(1);
    expect(c.items).toHaveLength(4);
    expect(c.unread).toBe(4);
  });
  it('marks one or all as read, and caps the list', () => {
    const c = new NotificationCenter();
    c.add([n('a', 1), n('b', 2)]);
    c.markRead('a');
    expect(c.unread).toBe(1);
    c.markAllRead();
    expect(c.unread).toBe(0);
    c.add(Array.from({ length: MAX_NOTIFICATIONS + 20 }, (_, i) => n(`x${i}`, 100 + i)));
    expect(c.items).toHaveLength(MAX_NOTIFICATIONS);
    expect(c.items[0].id).toBe(`x${MAX_NOTIFICATIONS + 19}`);
  });
});

describe('supervisor: robot alerts', () => {
  it('a blocked robot notifies once, with buttons to locate it and to open the full view, and again after it recovers', () => {
    const w = new RobotAlertWatcher((id) => (id === 'f1' ? 'Line Side Fleet' : id));
    const blocked = bot({
      state: 'blocked',
      alerts: [{ code: 'OBSTACLE', severity: 'critical', msg: 'Path obstructed' }],
    });
    const first = w.ingest(1000, [blocked]);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      kind: 'blocked',
      level: 'critical',
      title: 'AMR-001 is blocked',
      body: 'Path obstructed · Line Side Fleet',
      actions: [{ kind: 'locate', robotId: 'AMR-001' }, { kind: 'live-floor' }],
    });
    expect(w.ingest(2000, [blocked])).toHaveLength(0);
    expect(w.ingest(3000, [bot({})])).toHaveLength(0);
    const again = w.ingest(9000, [blocked]);
    expect(again).toHaveLength(1);
    expect(again[0].id).not.toBe(first[0].id);
  });
  it('a long wait notifies after the threshold, with the reason, once per wait', () => {
    const w = new RobotAlertWatcher();
    const waiting = bot({
      state: 'waiting',
      alerts: [
        { code: 'INTERSECTION_WAIT', severity: 'info', msg: 'Waiting for the intersection to clear (AMR-008 first)' },
      ],
    });
    expect(w.ingest(0, [waiting])).toHaveLength(0);
    expect(w.ingest((STUCK_AFTER_S - 1) * 1000, [waiting])).toHaveLength(0);
    const out = w.ingest(STUCK_AFTER_S * 1000, [waiting]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'stuck', level: 'warn' });
    expect(out[0].body).toContain('AMR-008 first');
    expect(w.ingest((STUCK_AFTER_S + 30) * 1000, [waiting])).toHaveLength(0);
  });
  it('low battery notifies once, not for a robot that is charging, and re-arms only after it has charged up', () => {
    const w = new RobotAlertWatcher();
    expect(w.ingest(0, [bot({ battery: 20 })])).toHaveLength(1);
    expect(w.ingest(1000, [bot({ battery: 19 })])).toHaveLength(0);
    expect(w.ingest(2000, [bot({ battery: 30 })])).toHaveLength(0);
    expect(w.ingest(3000, [bot({ battery: 20 })])).toHaveLength(0); // 30% is not recovered yet
    expect(w.ingest(4000, [bot({ battery: 90 })])).toHaveLength(0);
    expect(w.ingest(5000, [bot({ battery: 20 })])).toHaveLength(1);
    expect(new RobotAlertWatcher().ingest(0, [bot({ battery: 10, state: 'charging' })])).toHaveLength(0);
  });
});

describe('configurator: MES notifications', () => {
  it('have a history, then new stock and data imports, with no buttons (information only)', () => {
    const old = mesBackfill(1_000_000);
    expect(old.length).toBeGreaterThanOrEqual(3);
    expect(old.every((x) => x.at < 1_000_000 && !x.actions)).toBe(true);
    const stock = mesNext(5, 0, () => 0),
      data = mesNext(6, 1, () => 0);
    expect(stock).toMatchObject({ kind: 'stock', title: 'New stock has been added' });
    expect(stock.body).toMatch(/DCP-\d+ · .+: \+\d+ units/);
    expect(data).toMatchObject({ kind: 'mes', title: 'New data from MES' });
    expect(stock.actions).toBeUndefined();
  });
  it('each audience has its own sources', () => {
    expect(SOURCES.supervisor()).toHaveLength(1);
    expect(SOURCES.configurator()).toHaveLength(1);
    expect(SOURCES.supervisor()[0]).not.toBe(SOURCES.configurator()[0]);
  });
});

const user = (
  username: string,
  role: 'supervisor' | 'configurator' = 'supervisor',
  custom?: PublicUser['custom'],
): PublicUser => ({
  username,
  role,
  custom,
  name: username,
  firstName: username,
  lastName: '',
  email: `${username}@x.com`,
  title: '',
  avatar: '',
});
const memCache = () => {
  const mem = new Map<string, AppNotification[]>();
  const doc = (u: string) =>
    ({
      read: () => mem.get(u) ?? null,
      save: async (v: AppNotification[]) => void mem.set(u, v),
      subscribe: () => () => {},
      clear: () => void mem.delete(u),
    }) as never;
  return { mem, doc };
};
/** A fake notification API: records what the store asks for and lets the test push new notifications. */
function fakeApi(history: Record<string, NewNotification[]> = {}) {
  const calls: string[] = [];
  const emitters = new Map<string, (i: NewNotification[]) => void>();
  const read: string[][] = [];
  const api: NotificationApi = {
    history: async (u) => {
      calls.push(`history ${u.username}`);
      return history[u.username] ?? [];
    },
    subscribe: (u, emit) => {
      calls.push(`subscribe ${u.username}`);
      emitters.set(u.username, emit);
      return () => {
        calls.push(`stop ${u.username}`);
        emitters.delete(u.username);
      };
    },
    markRead: async (_u, ids) => void read.push(ids),
  };
  return { api, calls, push: (u: string, i: NewNotification[]) => emitters.get(u)?.(i), read };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('the data component: any API plugs in', () => {
  it('loads history, listens for new notifications and stops listening when the user changes', async () => {
    const f = fakeApi({ arjun: [n('h1', 1)] });
    const { doc } = memCache();
    const st = createNotificationStore(f.api, doc);
    st.getState().open(user('arjun'));
    await settle();
    expect(f.calls).toEqual(['subscribe arjun', 'history arjun']);
    expect(st.getState().items.map((x) => x.id)).toEqual(['h1']);
    f.push('arjun', [n('live1', 5)]);
    expect(st.getState().items.map((x) => x.id)).toEqual(['live1', 'h1']);
    st.getState().open(null);
    expect(f.calls).toContain('stop arjun');
    expect(st.getState().items).toEqual([]);
  });
  it('every user sees only their own notifications and read state, kept between sessions', async () => {
    const f = fakeApi();
    const { doc, mem } = memCache();
    const st = createNotificationStore(f.api, doc);
    st.getState().open(user('arjun'));
    f.push('arjun', [n('a1', 1)]);
    st.getState().open(user('kavin', 'configurator'));
    expect(st.getState().items).toEqual([]);
    f.push('kavin', [n('k1', 2)]);
    st.getState().open(user('arjun'));
    expect(st.getState().items.map((x) => x.id)).toEqual(['a1']);
    st.getState().markRead('a1');
    st.getState().open(user('kavin', 'configurator'));
    expect(mem.get('arjun')![0]).toMatchObject({ id: 'a1', read: true }); // saved on the switch, no timer needed
    expect(st.getState().items.map((x) => x.id)).toEqual(['k1']);
  });
  it('tells the API what was read (one or all) and carries on if the API fails', async () => {
    const f = fakeApi();
    const { doc } = memCache();
    const st = createNotificationStore(f.api, doc);
    st.getState().open(user('arjun'));
    f.push('arjun', [n('a', 1), n('b', 2), n('c', 3)]);
    st.getState().markRead('a');
    st.getState().markAllRead();
    expect(f.read).toEqual([['a'], ['c', 'b']]);
    expect(st.getState().items.every((x) => x.read)).toBe(true);
    const failing = createNotificationStore(
      {
        subscribe: () => () => {},
        history: async () => {
          throw new Error('offline');
        },
        markRead: async () => {
          throw new Error('offline');
        },
      },
      doc,
    );
    failing.getState().open(user('x'));
    failing.getState().add([n('z', 1)]);
    failing.getState().markRead('z');
    await settle();
    expect(failing.getState().items[0].read).toBe(true);
  });
  it('ignores a history answer that arrives after the user has changed', async () => {
    let release: (v: NewNotification[]) => void = () => {};
    const slow: NotificationApi = {
      subscribe: () => () => {},
      history: (u) =>
        u.username === 'arjun'
          ? new Promise((r) => {
              release = r;
            })
          : Promise.resolve([]),
    };
    const st = createNotificationStore(slow, memCache().doc);
    st.getState().open(user('arjun'));
    st.getState().open(user('kavin', 'configurator'));
    release([n('late', 1)]);
    await settle();
    expect(st.getState().items).toEqual([]);
  });
  it('the local implementation runs the sources of the audiences the user belongs to (a configurator with the supervisor pages ticked, both)', () => {
    const started: string[] = [];
    const src = (name: string) => ({
      start: () => {
        started.push(name);
        return () => void started.push('stop ' + name);
      },
    });
    const api = localApi({
      supervisor: () => [src('live')],
      operator: () => [],
      configurator: () => [src('mes'), src('other')],
    });
    const stop = api.subscribe(user('kavin', 'configurator'), () => {});
    expect(started).toEqual(['mes', 'other']);
    stop();
    expect(started).toEqual(['mes', 'other', 'stop mes', 'stop other']);
  });
  it('a configurator who also holds the supervisor pages receives the notifications of both workspaces', () => {
    const started: string[] = [];
    const src = (name: string) => ({
      start: () => {
        started.push(name);
        return () => {};
      },
    });
    const api = localApi({ supervisor: () => [src('live')], operator: () => [], configurator: () => [src('mes')] });
    api.subscribe(user('meera', 'configurator', { add: ['supervisor.dashboard'], remove: [] }), () => {});
    expect(started.sort()).toEqual(['live', 'mes']);
  });
});

describe('the REST implementation (the server shape)', () => {
  const res = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;
  it('asks for the history, polls for newer notifications and reports what was read', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    let batch: NewNotification[] = [n('s1', 100)];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return res(init?.method === 'POST' ? {} : { items: batch });
    }) as unknown as typeof fetch;
    const api = restApi({ baseUrl: '/api', pollMs: 5, fetch: fake, headers: () => ({ Authorization: 'Bearer t' }) });
    expect((await api.history!(user('arjun'))).map((x) => x.id)).toEqual(['s1']);
    expect(calls[0].url).toBe('/api/users/arjun/notifications?since=0');
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer t');
    const got: string[] = [];
    const stop = api.subscribe(user('arjun'), (items) => got.push(...items.map((x) => x.id)));
    batch = [n('s2', Date.now() + 1000)];
    await new Promise((r) => setTimeout(r, 30));
    stop();
    expect(got).toContain('s2');
    await api.markRead!(user('arjun'), ['s1']);
    const post = calls.at(-1)!;
    expect(post.url).toBe('/api/users/arjun/notifications/read');
    expect(JSON.parse(String(post.init?.body))).toEqual({ ids: ['s1'] });
  });
  it('a failing server does not break the feed', async () => {
    const bad = (async () => res({}, false)) as unknown as typeof fetch;
    const api = restApi({ baseUrl: '/api', pollMs: 5, fetch: bad });
    await expect(api.history!(user('a'))).rejects.toThrow();
    const stop = api.subscribe(user('a'), () => {
      throw new Error('should not be called');
    });
    await new Promise((r) => setTimeout(r, 20));
    stop();
  });
});

describe('time', () => {
  it('reads naturally', () => {
    const t = 10_000_000;
    expect(timeAgo(t, t + 10_000)).toBe('just now');
    expect(timeAgo(t, t + 5 * 60_000)).toBe('5 min ago');
    expect(timeAgo(t, t + 3 * 3_600_000)).toBe('3 h ago');
    expect(timeAgo(t, t + 50 * 3_600_000)).toBe('2 d ago');
  });
});
