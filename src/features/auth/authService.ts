import { toPublic, userDirectory } from './userDirectory';
import type { PublicUser } from './types';

const byName = (username: string) => userDirectory.getState().users.find((x) => x.username === username.trim().toLowerCase());

export function findUser(username: string): PublicUser | null { const u = byName(username); return u ? toPublic(u) : null; }

/** Pure credential check (username is case-insensitive, password exact). Swap for an API call later; callers only use the result. */
export function authenticate(username: string, password: string): PublicUser | null {
  const u = byName(username); return u && u.password === password ? toPublic(u) : null;
}
