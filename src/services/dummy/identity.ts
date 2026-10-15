import { z } from 'zod';
import { createValidatedDocument, localBackend, sessionBackend, type StorageBackend } from '@/data/storage';
import seedDataset from '@/fixtures/dataset.json';
import { ALL_PERMISSIONS, isFleetScoped, presetOf } from '@/features/access';
import type { UserRecord } from '@/features/auth/types';
import { SEED_CREDENTIALS, SEED_REVISION, SEED_SINCE, SEED_USERS } from '@/fixtures/users';
import { log } from '@/platform';
import type { AuthService, SessionService, UserService } from '../ports';

/**
 * DUMMY identity: user profiles, credentials and the session, kept in browser storage and seeded from `src/fixtures/users.ts`. A real deployment replaces all three ports with an
 * identity provider and a user service. Profiles never carry a password; credentials live in their own document and only `signIn` / `setPassword` read them.
 */
export const USERS_KEY = 'atiflow.users.v1';
export const CREDENTIALS_KEY = 'atiflow.credentials.v1';
export const SEED_REVISION_KEY = 'atiflow.users.seedRevision';
export const SESSION_KEY = 'atiflow.session';

const UserSchema = z.object({
  username: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  role: z.string(),
  title: z.string(),
  custom: z.object({ add: z.array(z.string()), remove: z.array(z.string()) }).optional(),
  fleets: z.array(z.string()).optional(),
  avatar: z.string().optional(),
  /** only in a directory saved before credentials were separated: moved to the credential store on load */
  password: z.string().optional(),
});
const UsersSchema = z.array(UserSchema);
const CredentialsSchema = z.record(z.string(), z.string());

/** The operator permissions were renamed (Dispatch is now Approve) and Confirm was dropped: saved ticks follow. */
const RENAMED: Record<string, string | null> = { 'operator.dispatch': 'operator.approve', 'operator.confirm': null };
const renamePermissions = (u: UserRecord): UserRecord =>
  !u.custom
    ? u
    : {
        ...u,
        custom: {
          add: [
            ...new Set(u.custom.add.flatMap((p) => (p in RENAMED ? (RENAMED[p] ? [RENAMED[p]] : []) : [p]))),
          ] as typeof u.custom.add,
          remove: [
            ...new Set(u.custom.remove.flatMap((p) => (p in RENAMED ? (RENAMED[p] ? [RENAMED[p]] : []) : [p]))),
          ] as typeof u.custom.remove,
        },
      };
/** Bring a saved directory up to date: removed roles become today's roles, renamed permissions follow, a person without fleets (saved before fleet scope) sees every fleet. */
const SEED_FLEET_IDS = (): string[] => seedDataset.fleets.map((f) => f.id);
export const migrateUsers = (list: UserRecord[], fleetIds: () => string[] = SEED_FLEET_IDS): UserRecord[] =>
  list.map((u0) => {
    let u = u0;
    if ((u.role as string) === 'line-supervisor') u = { ...u, role: 'supervisor', custom: undefined }; // the Line Supervisor role was removed: those users are supervisors
    u = renamePermissions(u);
    const v: UserRecord =
      (u.role as string) === 'superuser'
        ? {
            ...u,
            role: 'configurator',
            custom: { add: ALL_PERMISSIONS.filter((p) => !presetOf('configurator').includes(p)), remove: [] },
          }
        : u;
    return isFleetScoped(v.role) && !v.fleets?.length ? { ...v, fleets: fleetIds() } : v;
  });

/**
 * A saved directory keeps the access a seed user had when it was saved, so a feature added later never reaches them (Meera, who has every module ticked, would miss it).
 * When `SEED_REVISION` has grown since the list was saved, the seed users' starting extra access is added again, once; everything else they or a configurator changed stays.
 */
export function applySeedRevision(list: UserRecord[], savedRevision: number): UserRecord[] {
  if (savedRevision >= SEED_REVISION) return list;
  const added = SEED_USERS.filter(
    (s) => (SEED_SINCE[s.username] ?? 0) > savedRevision && !list.some((u) => u.username === s.username),
  ); // a starting user introduced after this list was saved
  return [...list, ...structuredClone(added)].map((u) => {
    const s = SEED_USERS.find((x) => x.username === u.username)?.custom;
    if (!s?.add.length && !s?.remove.length) return u;
    return {
      ...u,
      custom: {
        add: [...new Set([...(u.custom?.add ?? []), ...s.add])],
        remove: [...new Set([...(u.custom?.remove ?? []).filter((p) => !s.add.includes(p)), ...s.remove])],
      },
    };
  });
}

export interface IdentityOptions {
  /** Storage under one key (local storage by default; tests pass memory). */
  backend?: (key: string) => StorageBackend;
  /** Per-tab storage for a session that should not outlive the browser. */
  sessionBackend?: (key: string) => StorageBackend;
  /** How long `signIn` takes (a real sign-in is a network request): the app uses a short pause so the button's busy state is visible; tests use none. */
  latencyMs?: number;
  /** The ids of every fleet (a saved user without fleets is given all of them). Defaults to the starting fleets. */
  fleetIds?: () => string[];
}
const norm = (u: string) => u.trim().toLowerCase();

export function createDummyIdentity(opts: IdentityOptions = {}): {
  users: UserService;
  auth: AuthService;
  session: SessionService;
} {
  const backend = opts.backend ?? localBackend;
  const tabBackend = opts.sessionBackend ?? sessionBackend;
  const usersDoc = createValidatedDocument({
    backend: backend(USERS_KEY),
    schema: UsersSchema,
    seed: () => structuredClone(SEED_USERS) as z.infer<typeof UsersSchema>,
    onInvalid: (why) => log.child('identity').warn(`saved users ignored: ${why}`),
  });
  const credentialsDoc = createValidatedDocument({
    backend: backend(CREDENTIALS_KEY),
    schema: CredentialsSchema,
    seed: () => ({ ...SEED_CREDENTIALS }),
    onInvalid: (why) => log.child('identity').warn(`saved credentials ignored: ${why}`),
  });
  const revision = backend(SEED_REVISION_KEY);
  let credentials: Record<string, string> | null = null;
  const creds = () => (credentials ??= credentialsDoc.load());
  const saveCreds = (next: Record<string, string>) => {
    credentials = next;
    credentialsDoc.save(next);
  };

  function loadUsers(): UserRecord[] {
    const raw = usersDoc.load() as (UserRecord & { password?: string })[];
    const legacy = raw.filter((u) => typeof u.password === 'string'); // passwords kept in the profiles by an older directory move to the credential store
    if (legacy.length)
      saveCreds({ ...creds(), ...Object.fromEntries(legacy.map((u) => [u.username, u.password as string])) });
    const profiles = raw.map(({ password: _password, ...u }) => u as UserRecord);
    const list = migrateUsers(profiles, opts.fleetIds);
    const rev = Number(revision.read() ?? 0) || 0;
    if (rev >= SEED_REVISION) return list;
    const next = applySeedRevision(list, rev);
    const missing = Object.entries(SEED_CREDENTIALS).filter(
      ([u]) => next.some((x) => x.username === u) && !(u in creds()),
    ); // a starting user added by the revision can sign in
    if (missing.length) saveCreds({ ...creds(), ...Object.fromEntries(missing) });
    revision.write(String(SEED_REVISION));
    usersDoc.save(next);
    return next;
  }
  let cache: UserRecord[] | null = null;
  const users: UserService = {
    snapshot: () => (cache ??= loadUsers()),
    hydrate: async () => (cache = loadUsers()),
    save: async (value) => {
      cache = value;
      usersDoc.save(value);
    },
    subscribe(listener) {
      if (typeof window === 'undefined') return () => {};
      const on = (e: StorageEvent) => {
        if (e.key !== USERS_KEY || !e.newValue) return;
        const r = usersDoc.parse(e.newValue);
        if ('value' in r)
          listener(
            (cache = migrateUsers(
              r.value.map(({ password: _p, ...u }) => u as UserRecord),
              opts.fleetIds,
            )),
          );
      };
      window.addEventListener('storage', on);
      return () => window.removeEventListener('storage', on);
    },
    resetToSeed() {
      credentialsDoc.reset();
      credentials = null;
      revision.remove();
      return (cache = usersDoc.reset() as UserRecord[]);
    },
  };

  const auth: AuthService = {
    async signIn(username, password) {
      if (opts.latencyMs) await new Promise((r) => setTimeout(r, opts.latencyMs));
      const name = norm(username);
      const exists = users.snapshot().some((u) => u.username === name);
      return exists && creds()[name] === password ? name : null;
    },
    async setPassword(username, password) {
      saveCreds({ ...creds(), [norm(username)]: password });
    },
    async removeCredentials(username) {
      const { [norm(username)]: _gone, ...rest } = creds();
      saveCreds(rest);
    },
  };

  const local = backend(SESSION_KEY);
  const tab = tabBackend(SESSION_KEY);
  const session: SessionService = {
    read() {
      try {
        const raw = local.read() ?? tab.read();
        return raw ? String(JSON.parse(raw).username) : null;
      } catch {
        return null;
      }
    },
    write(username, keep) {
      local.remove();
      tab.remove();
      (keep ? local : tab).write(JSON.stringify({ username }));
    },
    clear() {
      local.remove();
      tab.remove();
    },
  };
  return { users, auth, session };
}
