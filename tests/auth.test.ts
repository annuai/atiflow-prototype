import { describe, it, expect } from 'vitest';
import { findUser } from '../src/features/auth/authService';
import { AVATARS, SEED_CREDENTIALS, SEED_USERS } from '../src/fixtures/users';
import { createDummyIdentity, CREDENTIALS_KEY, USERS_KEY } from '../src/services/dummy/identity';
import { memoryStorage } from './helpers/memoryStorage';

const fresh = (initial?: Record<string, string>) => {
  const m = memoryStorage(initial);
  return { ...createDummyIdentity({ backend: m.backend, sessionBackend: memoryStorage().backend }), mem: m };
};

describe('identity services (dummy)', () => {
  it.each([
    ['arjun', 'supervisor'],
    ['kavin', 'configurator'],
    ['meera', 'configurator'],
  ])('%s signs in with 1234 as %s', async (u, role) => {
    const { auth, users } = fresh();
    const name = await auth.signIn(u, '1234');
    expect(name).toBe(u);
    expect(users.snapshot().find((x) => x.username === name)?.role).toBe(role);
    expect(findUser(u)).not.toHaveProperty('password');
  });
  it('username is case-insensitive and trimmed; password is exact', async () => {
    const { auth } = fresh();
    expect(await auth.signIn('  Arjun ', '1234')).toBe('arjun');
    expect(await auth.signIn('arjun', '12345')).toBeNull();
    expect(await auth.signIn('arjun', '')).toBeNull();
  });
  it('rejects unknown users', async () => {
    const { auth } = fresh();
    expect(await auth.signIn('nobody', '1234')).toBeNull();
    expect(findUser('nobody')).toBeNull();
  });
  it('profiles carry no password: credentials are a separate document, and old passwords move there', async () => {
    const { users, auth, mem } = fresh({
      [USERS_KEY]: JSON.stringify([
        {
          username: 'zed',
          password: 'secret',
          firstName: 'Z',
          lastName: '',
          email: 'z@x.co',
          role: 'supervisor',
          title: 'T',
          fleets: ['line-side'],
        },
      ]),
    });
    expect(users.snapshot()[0]).not.toHaveProperty('password');
    expect(await auth.signIn('zed', 'secret')).toBe('zed');
    expect(JSON.parse(mem.data.get(CREDENTIALS_KEY)!).zed).toBe('secret');
  });
  it('set and remove password; the session remembers the person on this device or only this tab', async () => {
    const { auth, session } = fresh();
    await auth.setPassword('Arjun', 'new-pass');
    expect(await auth.signIn('arjun', 'new-pass')).toBe('arjun');
    expect(await auth.signIn('arjun', '1234')).toBeNull();
    await auth.removeCredentials('arjun');
    expect(await auth.signIn('arjun', 'new-pass')).toBeNull();
    expect(session.read()).toBeNull();
    session.write('kavin', false);
    expect(session.read()).toBe('kavin');
    session.clear();
    expect(session.read()).toBeNull();
  });
  it('every user has a name, an e-mail and a unique username (the first three also have a picture; the operators show initials)', () => {
    expect(new Set(SEED_USERS.map((u) => u.username)).size).toBe(SEED_USERS.length);
    for (const u of SEED_USERS) {
      if (['arjun', 'kavin', 'meera'].includes(u.username)) expect(AVATARS[u.username]).toBeTruthy();
      expect(findUser(u.username)?.name).toBeTruthy();
      expect(u.email).toMatch(/@/);
      expect(SEED_CREDENTIALS[u.username]).toBeTruthy();
    }
  });
});
