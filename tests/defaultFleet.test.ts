import { describe, expect, it } from 'vitest';
import { chooseFleet } from '../src/features/live-floor/defaultFleet';

const o = { visible: ['line-side', 'asrs', 'new'], running: ['asrs', 'line-side'], preferred: '' };

describe('which fleet the Live Floor shows (there is no "all fleets" view)', () => {
  it('keeps the fleet that is already chosen', () => {
    expect(chooseFleet({ ...o, current: 'asrs' })).toBe('asrs');
  });
  it('"all" (nothing chosen yet) becomes the person’s own choice', () => {
    expect(chooseFleet({ ...o, current: 'all', preferred: 'asrs' })).toBe('asrs');
  });
  it('without a choice it is the first visible fleet that is on the floor', () => {
    expect(chooseFleet({ ...o, current: 'all', visible: ['new', 'asrs', 'line-side'] })).toBe('asrs');
  });
  it('a choice the person can no longer see is ignored', () => {
    expect(chooseFleet({ ...o, current: 'all', preferred: 'hidden', visible: ['line-side'] })).toBe('line-side');
    expect(chooseFleet({ ...o, current: 'gone' })).toBe('line-side');
  });
  it('when no visible fleet is on the floor it is the first visible one (the floor says why it is not on it)', () => {
    expect(chooseFleet({ ...o, current: 'all', visible: ['new'], running: [] })).toBe('new');
  });
  it('a person who can see no fleet gets none', () => {
    expect(chooseFleet({ ...o, current: 'all', visible: [] })).toBeNull();
  });
});
