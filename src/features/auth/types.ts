import type { Custom, RoleId } from '@/features/access';

/** Who may do what is the access feature's business: a user has a role (a preset of permissions) and may be customised on top. */
export type Role = RoleId;

export interface UserRecord {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  /** Permissions added to / removed from the role's preset for this one user. */
  custom?: Custom;
  /** Fleet ids this person sees (supervisors and operators; at least one). Configurators always see every fleet. */
  fleets?: string[];
  /** Shown under the avatar; defaults to the role's name. */
  title: string;
  /** A picture chosen when the user was added (a small data URL). The starting users have theirs in `users.ts`. */
  avatar?: string;
}
/** A user as the app shows them (the record has no password: credentials live in the sign-in service). `name` is first + last name, `avatar` the picture (none for users without one: the UI shows initials). */
export type PublicUser = UserRecord & { name: string };
