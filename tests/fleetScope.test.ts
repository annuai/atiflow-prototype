import { describe, expect, it } from 'vitest';
import { fleetScope, fleetsError, isFleetScoped, scopeKey } from '../src/features/access';
import { migrate } from '../src/features/auth/userDirectory';
import { SEED_USERS } from '../src/features/auth/users';
import { validateBasics, validateNew } from '../src/features/users/model/validate';
import { datasetStore } from '../src/data/dataset';

const ALL = ['line-side', 'assembly'];
describe('fleet scope', () => {
  it('supervisors and operators are limited to their fleets; configurators see everything', () => {
    expect(fleetScope({ role: 'supervisor', fleets: ['assembly'] }, ALL)).toEqual(['assembly']); expect(fleetScope({ role: 'operator', fleets: ['line-side', 'gone'] }, ALL)).toEqual(['line-side']);
    expect(fleetScope({ role: 'configurator' }, ALL)).toBeNull(); expect(isFleetScoped('configurator')).toBe(false); expect(isFleetScoped('operator')).toBe(true);
  });
  it('a scoped person without any fleet sees nothing (never everything)', () => { expect(fleetScope({ role: 'supervisor', fleets: [] }, ALL)).toEqual([]); expect(fleetScope({ role: 'supervisor' }, ALL)).toEqual([]); });
  it('at least one fleet is required for supervisor and operator, not for a configurator', () => {
    expect(fleetsError('supervisor', [])).toBeTruthy(); expect(fleetsError('operator', ['x'])).toBe(''); expect(fleetsError('configurator', [])).toBe('');
  });
  it('the Users forms report a missing fleet', () => {
    const ok = { firstName: 'A', lastName: '', username: 'new_user', email: 'a@b.co', password: 'abcd', role: 'operator' as const, title: '', fleets: [] as string[] };
    expect(validateNew(ok, () => false, ['operator']).fleets).toBeTruthy(); expect(validateNew({ ...ok, fleets: ['line-side'] }, () => false, ['operator'])).toEqual({});
    expect(validateNew({ ...ok, role: 'configurator' }, () => false, ['configurator'])).toEqual({});
    expect(validateBasics({ firstName: 'A', email: 'a@b.co', role: 'supervisor', fleets: [] }).fleets).toBeTruthy(); expect(validateBasics({ firstName: 'A', email: 'a@b.co', role: 'supervisor', fleets: ['assembly'] })).toEqual({});
  });
  it('the scope key changes when the person or the fleets change', () => {
    const a = scopeKey({ username: 'a', role: 'supervisor', fleets: ['line-side'] }, ALL); expect(scopeKey({ username: 'a', role: 'supervisor', fleets: ['line-side'] }, ALL)).toBe(a);
    expect(scopeKey({ username: 'a', role: 'supervisor', fleets: ['assembly'] }, ALL)).not.toBe(a); expect(scopeKey({ username: 'b', role: 'supervisor', fleets: ['line-side'] }, ALL)).not.toBe(a);
  });
  it('Arjun starts with both fleets; a person saved before scope existed keeps seeing everything', () => {
    expect(SEED_USERS.find((u) => u.username === 'arjun')!.fleets).toEqual(['line-side', 'assembly']);
    const saved = [{ ...SEED_USERS[0], fleets: undefined }, { ...SEED_USERS[1] }]; const out = migrate(saved);
    expect(out[0].fleets).toEqual(datasetStore.getState().fleets.map((f) => f.id)); expect(out[1].fleets).toBeUndefined();
  });
});
