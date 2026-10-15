import { ALL_PERMISSIONS, presetOf } from '@/features/access';
import type { UserRecord } from './types';
import arjun from './avatars/arjun.png';
import kavin from './avatars/kavin.png';
import meera from './avatars/meera.png';

/**
 * The STARTING users (the live list is the editable directory, `userDirectory.ts`, which the Users page manages). Plain-text passwords and example e-mail
 * addresses are intentional for this prototype. Avatars are not stored with the users: they are looked up here by username.
 */
export const SEED_USERS: UserRecord[] = [
  { username: 'arjun', password: '1234', firstName: 'Arjun', lastName: 'Singh', email: 'arjun@atimotors.com', role: 'supervisor', fleets: ['line-side', 'assembly'], title: 'Lead Supervisor' },
  { username: 'kavin', password: '1234', firstName: 'Kavin', lastName: '', email: 'kavin@atimotors.com', role: 'configurator', title: 'Ati Support Engineer' },
  { username: 'meera', password: '1234', firstName: 'Meera', lastName: '', email: 'meera@atimotors.com', role: 'configurator', custom: { add: ALL_PERMISSIONS.filter((p) => !presetOf('configurator').includes(p)), remove: [] }, title: 'System Integrator' },       // a configurator who also has every other module ticked
  { username: 'rohan', password: '1234', firstName: 'Rohan', lastName: 'Mehta', email: 'rohan@atimotors.com', role: 'operator', custom: { add: [], remove: ['operator.approve'] }, fleets: ['line-side'], title: 'Line Operator' },
  { username: 'sneha', password: '1234', firstName: 'Sneha', lastName: 'Rao', email: 'sneha@atimotors.com', role: 'operator', custom: { add: [], remove: ['operator.approve'] }, fleets: ['assembly'], title: 'Preparation Operator' },
  { username: 'vikram', password: '1234', firstName: 'Vikram', lastName: 'Nair', email: 'vikram@atimotors.com', role: 'operator', fleets: ['line-side', 'assembly'], title: 'Store Operator' },
];
/** The revision in which a starting user first existed: a saved directory older than that gets the user added once (see `applySeedRevision`). */
export const SEED_SINCE: Record<string, number> = { rohan: 4, sneha: 4, vikram: 5 };
/** Bump this when the starting access of a seed user changes (e.g. Meera gets a new feature): a saved directory gets the new starting access added once (see `applySeedRevision`). */
export const SEED_REVISION = 6;
export const AVATARS: Record<string, string> = { arjun, kavin, meera };
