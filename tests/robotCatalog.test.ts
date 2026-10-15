import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { ROBOT_TYPES, ROBOT_TYPE_LABELS, robotTypeById, robotTypeByLabel } from '../src/data/robotTypes';
import { robotRecords, robotsOnFloor } from '../src/data/robots';
import { datasetStore } from '../src/data/dataset';
import { KINDS } from '../src/features/devices/model/kinds';
import { ROBOT_MODELS } from '../src/engine/robotMesh';
import { rosterFrom, rosterSignature } from '../src/features/live-floor/liveFeed';

const nav = JSON.parse(fs.readFileSync('public/sites/ecc/nav.json', 'utf8'));

describe('robot type catalog: one list for the configurator, the supervisor and the 3D scene', () => {
  it('every type has an SVG illustration, a 3D model file and a 3D registry entry; ids and labels are unique', () => {
    expect(new Set(ROBOT_TYPES.map((t) => t.id)).size).toBe(ROBOT_TYPES.length);
    expect(new Set(ROBOT_TYPE_LABELS).size).toBe(ROBOT_TYPES.length);
    for (const t of ROBOT_TYPES) {
      if (t.placeholder) expect(t.illustration).toBeTruthy();
      else {
        expect(fs.existsSync(`src/assets/robots/${t.id}.svg`)).toBe(true);
        expect(fs.existsSync(`public/models/robots/${t.id}.glb`)).toBe(true);
      }
      expect(ROBOT_MODELS[t.id].footprint).toHaveLength(2);
    }
    expect(Object.keys(ROBOT_MODELS).sort()).toEqual(ROBOT_TYPES.map((t) => t.id).sort());
  });
  it('the Sherpa Type choices of the Robots page are the catalog labels; unknown types fall back to the default', () => {
    expect(KINDS.robot.fields.find((f) => f.key === 'sherpaType')!.options).toEqual(ROBOT_TYPE_LABELS);
    expect(robotTypeByLabel('nonsense').id).toBe('sherpa-xt-lite');
    expect(robotTypeById('pallet-mover').label).toBe('Pallet Mover');
  });
  it('seed: AMR-005 and AMR-010 are pallet movers, every robot has a known type', () => {
    const rec = robotRecords(datasetStore.getState());
    const by = (id: string) => rec.find((r) => r.id === id)!;
    expect(by('AMR-005').type.id).toBe('pallet-mover');
    expect(by('AMR-010').type.id).toBe('pallet-mover');
    for (const r of datasetStore.getState().robot) expect(ROBOT_TYPE_LABELS).toContain(r.values.sherpaType);
  });
});

describe('one dataset: what the configurator lists is what the supervisor sees', () => {
  it('every online, assigned robot of the Robots page is on the Live Floor with the same name, type and fleet; the others are not', () => {
    const recs = robotRecords(datasetStore.getState());
    const roster = rosterFrom(nav);
    const onFloor = robotsOnFloor(
      recs,
      nav.fleets.map((f: { id: string }) => f.id),
    );
    expect(roster.map((e) => e.id).sort()).toEqual(onFloor.map((r) => r.id).sort());
    for (const e of roster) {
      const r = recs.find((x) => x.id === e.id)!;
      expect(e.model).toBe(r.type.id);
      expect(e.fleetId).toBe(r.fleet!.liveId ?? r.fleet!.id);
    }
    for (const r of recs.filter((x) => !roster.some((e) => e.id === x.id)))
      expect(r.status === 'offline' || !r.fleet).toBe(true);
  });
  it('a robot edited in the configurator changes the roster signature (the feed restarts on it)', () => {
    const before = rosterSignature(rosterFrom(nav));
    const s = datasetStore.getState();
    s.updateDevice('robot', 'AMR-001', { sherpaType: 'Pallet Mover' });
    const after = rosterSignature(rosterFrom(nav));
    expect(after).not.toBe(before);
    s.updateDevice('robot', 'AMR-001', { sherpaType: 'Sherpa XT Lite' });
    expect(rosterSignature(rosterFrom(nav))).toBe(before);
  });
});
