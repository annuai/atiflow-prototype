import { ALL_PERMISSIONS, presetOf } from '@/features/access';
import type { UserRecord } from '@/features/auth/types';
import arjun from './avatars/arjun.png';
import kavin from './avatars/kavin.png';
import meera from './avatars/meera.png';

/**
 * DUMMY DATA. The STARTING users (the live list is the editable directory, `features/auth/userDirectory.ts`, which the Users page manages). Example e-mail addresses are
 * intentional. Profiles carry NO password: credentials are a separate thing (`SEED_CREDENTIALS` below), only the dummy sign-in service reads them, and a real identity
 * provider replaces both. Avatars are not stored with the users: they are looked up here by username.
 */
export const SEED_USERS: UserRecord[] = [
  {
    username: 'arjun',
    firstName: 'Arjun',
    lastName: 'Singh',
    email: 'arjun@atimotors.com',
    role: 'supervisor',
    fleets: ['line-side', 'assembly'],
    title: 'Lead Supervisor',
  },
  {
    username: 'kavin',
    firstName: 'Kavin',
    lastName: '',
    email: 'kavin@atimotors.com',
    role: 'configurator',
    title: 'Ati Support Engineer',
  },
  {
    username: 'meera',
    firstName: 'Meera',
    lastName: '',
    email: 'meera@atimotors.com',
    role: 'configurator',
    custom: { add: ALL_PERMISSIONS.filter((p) => !presetOf('configurator').includes(p)), remove: [] },
    title: 'System Integrator',
  }, // a configurator who also has every other module ticked
  {
    username: 'rohan',
    firstName: 'Rohan',
    lastName: 'Mehta',
    email: 'rohan@atimotors.com',
    role: 'operator',
    custom: { add: [], remove: ['operator.approve'] },
    fleets: ['line-side'],
    title: 'Line Operator',
  },
  {
    username: 'sneha',
    firstName: 'Sneha',
    lastName: 'Rao',
    email: 'sneha@atimotors.com',
    role: 'operator',
    fleets: ['assembly'],
    title: 'Preparation Operator',
  },
  {
    username: 'vikram',
    firstName: 'Vikram',
    lastName: 'Nair',
    email: 'vikram@atimotors.com',
    role: 'operator',
    fleets: ['line-side', 'assembly'],
    title: 'Store Operator',
  },
];
/** The revision in which a starting user first existed: a saved directory older than that gets the user added once (see `applySeedRevision`). */
export const SEED_SINCE: Record<string, number> = { rohan: 4, sneha: 4, vikram: 5 };
/** Bump this when the starting access of a seed user changes (e.g. Meera gets a new feature): a saved directory gets the new starting access added once (see `applySeedRevision`). */
export const SEED_REVISION = 8;
/** Starting access that was GIVEN in a revision (it was switched off before): a saved directory older than that revision has the tick turned back on once, by taking it off the user's removed list. */
export const SEED_GRANTS: Record<string, { since: number; permissions: string[] }> = {
  sneha: { since: 8, permissions: ['operator.approve'] },
};
export const AVATARS: Record<string, string> = { arjun, kavin, meera };

/** DUMMY credentials of the starting users (plain text on purpose, prototype only). Read by the dummy sign-in service and by nothing else. */
export const SEED_CREDENTIALS: Record<string, string> = Object.fromEntries(SEED_USERS.map((u) => [u.username, '1234']));
