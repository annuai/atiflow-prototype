import { toPublic, userDirectory } from './userDirectory';
import type { PublicUser } from './types';

export function findUser(username: string): PublicUser | null {
  const u = userDirectory.getState().users.find((x) => x.username === username.trim().toLowerCase());
  return u ? toPublic(u) : null;
}
