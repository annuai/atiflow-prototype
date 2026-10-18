import { SOURCES } from './sources';
import { enterableWorkspaces } from '@/features/access';
import type { Audience, NewNotification, NotificationApi, SourcesByAudience } from './types';

/** The audiences a user belongs to: the workspaces they can enter that have notifications. */
const audiencesOf = (user: Parameters<typeof enterableWorkspaces>[0]): Audience[] =>
  enterableWorkspaces(user)
    .map((w) => w.id)
    .filter((id): id is Audience => id === 'supervisor' || id === 'configurator' || id === 'operator');

/** Today's implementation: each audience's sources inside this app (live robot alerts, the mock MES feed). */
export const localApi = (sources: SourcesByAudience = SOURCES): NotificationApi => ({
  subscribe(user, emit) {
    // every workspace the person can enter keeps collecting (so nothing is missed), each notification says which workspace it is for
    const stops = audiencesOf(user).flatMap((a) =>
      sources[a]().map((s) => s.start((items) => emit(items.map((n) => ({ ...n, audience: n.audience ?? a }))), user)),
    );
    return () => stops.forEach((stop) => stop());
  },
});

export interface RestApiOptions {
  /** e.g. '/api'. The server answers `GET {baseUrl}/users/{username}/notifications?since={epoch ms}` with `{ items: NewNotification[] }` and accepts `POST {baseUrl}/users/{username}/notifications/read` with `{ ids: string[] }`. */
  baseUrl: string;
  /** how often to ask for news (a websocket or server-sent events source would deliver instantly instead) */
  pollMs?: number;
  /** extra headers, e.g. an authorisation token, read at call time */
  headers?: () => Record<string, string>;
  fetch?: typeof fetch;
}
/**
 * A notification API over plain HTTP: the wire format is exactly `NewNotification` (see types.ts), so the server only has to return that. `history` is the first page, `subscribe` polls for anything newer.
 * Use it by replacing `localApi()` with `restApi({ baseUrl: '/api' })` in `index.ts`.
 */
export function restApi(o: RestApiOptions): NotificationApi {
  const call = o.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const headers = () => ({ 'Content-Type': 'application/json', ...(o.headers?.() ?? {}) });
  const url = (u: string, path: string) => `${o.baseUrl}/users/${encodeURIComponent(u)}/notifications${path}`;
  const get = async (username: string, since: number): Promise<NewNotification[]> => {
    const r = await call(url(username, `?since=${since}`), { headers: headers() });
    if (!r.ok) throw new Error(`notifications: ${r.status}`);
    return ((await r.json()) as { items: NewNotification[] }).items ?? [];
  };
  return {
    history: (user) => get(user.username, 0),
    subscribe(user, emit) {
      let since = Date.now();
      let stopped = false;
      const t = setInterval(async () => {
        try {
          const items = await get(user.username, since);
          if (stopped || !items.length) return;
          since = Math.max(since, ...items.map((n) => n.at));
          emit(items);
        } catch {
          /* the next poll tries again */
        }
      }, o.pollMs ?? 15_000);
      return () => {
        stopped = true;
        clearInterval(t);
      };
    },
    async markRead(user, ids) {
      const r = await call(url(user.username, '/read'), {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ ids }),
      });
      if (!r.ok) throw new Error(`notifications: ${r.status}`);
    },
  };
}
