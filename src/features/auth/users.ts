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
  { username: 'arjun', password: '1234', firstName: 'Arjun', lastName: 'Singh', email: 'arjun@atimotors.com', role: 'supervisor', title: 'Lead Supervisor' },
  { username: 'kavin', password: '1234', firstName: 'Kavin', lastName: '', email: 'kavin@atimotors.com', role: 'configurator', title: 'Ati Support Engineer' },
  { username: 'meera', password: '1234', firstName: 'Meera', lastName: '', email: 'meera@atimotors.com', role: 'configurator', custom: { add: ALL_PERMISSIONS.filter((p) => !presetOf('configurator').includes(p)), remove: [] }, title: 'System Integrator' },       // a configurator who also has every other module ticked
];
export const AVATARS: Record<string, string> = { arjun, kavin, meera };
