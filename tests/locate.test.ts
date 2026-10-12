import { describe, expect, it } from 'vitest';
import { findTargets } from '../src/features/live-floor/locate';
import type { RobotTelemetry, Station } from '../src/core/types';

const robot = (id: string) => ({ id, state: 'moving' }) as RobotTelemetry;
const robots = Object.fromEntries(['TRP-20480', 'TRP-20487', 'TRP-20101'].map((id) => [id, robot(id)]));
const stations = [{ id: 'STA-101', name: 'PCBA WIP 1' }, { id: 'STA-120', name: 'Kitting' }] as Station[];

describe('Live Floor search box', () => {
  it('finds a robot or station by (part of) its id, case-insensitively', () => {
    expect(findTargets('trp-20487', robots, stations).map((h) => h.id)).toEqual(['TRP-20487']);
    expect(findTargets('20487', robots, stations)[0]).toMatchObject({ kind: 'robot', id: 'TRP-20487' });
    expect(findTargets('sta-120', robots, stations)[0]).toMatchObject({ kind: 'station', id: 'STA-120' });
  });
  it('a short number matches both kinds; the exact id comes first', () => {
    const hits = findTargets('101', robots, stations); expect(hits.map((h) => h.id).sort()).toEqual(['STA-101', 'TRP-20101']);
    expect(findTargets('STA-101', robots, stations)[0].id).toBe('STA-101');
  });
  it('returns nothing for empty text or no match', () => { expect(findTargets('  ', robots, stations)).toEqual([]); expect(findTargets('zzz', robots, stations)).toEqual([]); });
});
