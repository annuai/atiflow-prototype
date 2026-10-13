import { describe, it, expect } from 'vitest';
import { authenticate, findUser } from '../src/features/auth/authService';
import { AVATARS, SEED_USERS } from '../src/features/auth/users';

describe('auth service (prototype directory)', () => {
  it.each([['arjun', 'supervisor'], ['kavin', 'configurator'], ['meera', 'configurator']])('%s signs in with 1234 as %s', (u, role) => {
    const user = authenticate(u, '1234'); expect(user?.role).toBe(role); expect(user).not.toHaveProperty('password');
  });
  it('username is case-insensitive and trimmed; password is exact', () => {
    expect(authenticate('  Arjun ', '1234')?.username).toBe('arjun'); expect(authenticate('arjun', '12345')).toBeNull(); expect(authenticate('arjun', '')).toBeNull();
  });
  it('rejects unknown users', () => { expect(authenticate('nobody', '1234')).toBeNull(); expect(findUser('nobody')).toBeNull(); });
  it('every user has an avatar, a name and a unique username', () => {
    expect(new Set(SEED_USERS.map((u) => u.username)).size).toBe(SEED_USERS.length); for (const u of SEED_USERS) { expect(AVATARS[u.username]).toBeTruthy(); expect(findUser(u.username)?.name).toBeTruthy(); expect(u.email).toMatch(/@/); }
  });
});
