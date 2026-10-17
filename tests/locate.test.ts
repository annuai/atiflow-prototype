import { describe, expect, it } from 'vitest';
import { findTargets } from '../src/ui/locate';
import type { RobotTelemetry, Station } from '../src/core/types';

const robot = (id: string) => ({ id, state: 'moving' }) as RobotTelemetry;
const robots = Object.fromEntries(['AMR-001', 'AMR-007', 'AMR-101'].map((id) => [id, robot(id)]));
const stations = [
  { id: 'STA-101', name: 'PCBA WIP 1' },
  { id: 'STA-120', name: 'Kitting' },
] as Station[];

describe('Live Floor search box', () => {
  it('finds a robot or station by (part of) its id, case-insensitively', () => {
    expect(findTargets('amr-007', robots, stations).map((h) => h.id)).toEqual(['AMR-007']);
    expect(findTargets('007', robots, stations)[0]).toMatchObject({ kind: 'robot', id: 'AMR-007' });
    expect(findTargets('sta-120', robots, stations)[0]).toMatchObject({ kind: 'station', id: 'STA-120' });
  });
  it('a short number matches both kinds; the exact id comes first', () => {
    const hits = findTargets('101', robots, stations);
    expect(hits.map((h) => h.id).sort()).toEqual(['AMR-101', 'STA-101']);
    expect(findTargets('STA-101', robots, stations)[0].id).toBe('STA-101');
  });
  it('returns nothing for empty text or no match', () => {
    expect(findTargets('  ', robots, stations)).toEqual([]);
    expect(findTargets('zzz', robots, stations)).toEqual([]);
  });
});

describe('Live Floor search box, one fleet at a time', () => {
  const inFleet = (id: string, fleetId: string) => ({ id, state: 'moving', fleetId }) as RobotTelemetry;
  const two = Object.fromEntries([inFleet('AMR-001', 'a'), inFleet('AMR-101', 'b')].map((r) => [r.id, r]));
  const sts = [
    { id: 'STA-101', name: 'One', fleets: ['a'] },
    { id: 'STA-201', name: 'Two', fleets: ['b'] },
    { id: 'STA-301', name: 'Shared', fleets: ['a', 'b'] },
  ] as Station[];
  it('only the chosen fleet is searched', () => {
    expect(findTargets('1', two, sts, 10, 'a').map((h) => h.id)).toEqual(['AMR-001', 'STA-101', 'STA-301']);
    expect(findTargets('1', two, sts, 10, 'b').map((h) => h.id)).toEqual(['AMR-101', 'STA-201', 'STA-301']);
  });
  it('without a fleet (or "all") every fleet is searched', () => {
    expect(findTargets('1', two, sts, 10).length).toBe(5);
    expect(findTargets('1', two, sts, 10, 'all').length).toBe(5);
  });
});
