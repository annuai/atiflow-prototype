import { describe, expect, it } from 'vitest';
import seed from '../src/fixtures/dataset.json';
import { datasetStore } from '../src/data/dataset';
import { fleetIdIn } from '../src/data/fleetRefs';
import { FLEET_ID, asFleetId, type FleetRecord } from '../src/data/fleets';
import { fleetsStore } from '../src/features/fleets/model/store';
import { masterDataStore } from '../src/features/master-data/model/store';
import { wfStore } from '../src/features/workflow-builder/model/store';
import { setServices } from '../src/services';
import { createDummyServices } from '../src/services/dummy';
import { DATASET_KEY, FLEETS_KEY, MASTERDATA_KEY } from '../src/services/dummy/state';
import { memoryStorage } from './helpers/memoryStorage';

const fleets = seed.fleets as unknown as FleetRecord[];

describe('fleets are pointed at by id', () => {
  it('fleetIdIn: an id stays, an old name (any case) becomes its id, something unknown stays as it is', () => {
    expect(fleetIdIn(fleets, 'line-side')).toBe(FLEET_ID.lineSide);
    expect(fleetIdIn(fleets, 'Line Side Fleet')).toBe(FLEET_ID.lineSide);
    expect(fleetIdIn(fleets, ' assembly FLEET ')).toBe(FLEET_ID.assembly);
    expect(fleetIdIn(fleets, 'Gone Fleet')).toBe(asFleetId('Gone Fleet'));
  });

  it('data saved with fleet NAMES (before ids) is read as ids: robots, hardware, profiles and material assignments', () => {
    const old = structuredClone(seed) as typeof seed;
    for (const d of [...old.robot, ...old.hardware]) {
      const f = d.values.fleet && fleets.find((x) => x.id === d.values.fleet);
      if (f) d.values.fleet = f.name; // what an older version saved
    }
    const m = memoryStorage({
      [DATASET_KEY]: JSON.stringify(old),
      [FLEETS_KEY]: JSON.stringify({ 'Line Side Fleet': { mapId: 'main-assembly', groups: [] } }),
      [MASTERDATA_KEY]: JSON.stringify({
        materials: [{ code: 'A-1', name: 'a', group: '', fleets: ['Assembly Fleet', 'line-side'], updatedAt: 0 }],
        groups: [],
        areas: [],
      }),
    });
    setServices(createDummyServices({ backend: m.backend }));
    const fleetOf = (name: string) => datasetStore.getState().robot.find((r) => r.values.name === name)!.values.fleet;
    expect(fleetOf('AMR-001')).toBe(FLEET_ID.lineSide);
    expect(fleetOf('AMR-008')).toBe(FLEET_ID.assembly);
    expect(
      datasetStore.getState().hardware.every((h) => !h.values.fleet || fleets.some((f) => f.id === h.values.fleet)),
    ).toBe(true);
    expect(Object.keys(fleetsStore.getState().profiles)).toEqual([FLEET_ID.lineSide]);
    expect(masterDataStore.getState().materials[0].fleets).toEqual([FLEET_ID.assembly, FLEET_ID.lineSide]);
    // and workflows saved with a name (the seeds are brought up to date the same way)
    expect(
      Object.values(wfStore.getState().workflows).every((w) => !w.fleet || fleets.some((f) => f.id === w.fleet)),
    ).toBe(true);
  });

  it('renaming a fleet touches only the fleet list', () => {
    setServices(createDummyServices({ backend: memoryStorage().backend }));
    const before = JSON.stringify(datasetStore.getState().robot);
    datasetStore.getState().renameFleet(FLEET_ID.lineSide, 'Line Feeding');
    expect(datasetStore.getState().fleets.find((f) => f.id === FLEET_ID.lineSide)!.name).toBe('Line Feeding');
    expect(JSON.stringify(datasetStore.getState().robot)).toBe(before);
  });
});
