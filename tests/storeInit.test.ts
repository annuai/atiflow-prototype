import { describe, expect, it } from 'vitest';
import seed from '../src/fixtures/dataset.json';
import { datasetStore } from '../src/data/dataset';
import { fleetsStore } from '../src/features/fleets/model/store';
import { masterDataStore } from '../src/features/master-data/model/store';
import { settingsStore } from '../src/features/settings/data/store';
import { userDirectory } from '../src/features/auth/userDirectory';
import { wfStore } from '../src/features/workflow-builder/model/store';
import { setServices } from '../src/services';
import { createDummyServices } from '../src/services/dummy';
import { DATASET_KEY, FLEETS_KEY, MASTERDATA_KEY, SETTINGS_KEY } from '../src/services/dummy/state';
import { memoryStorage } from './helpers/memoryStorage';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('stores follow the services', () => {
  it('replacing the services makes every store read the new ones, and what was just read is not written back', async () => {
    // a first set of services the stores start from
    setServices(createDummyServices({ backend: memoryStorage().backend }));
    expect(datasetStore.getState().fleets.some((f) => f.id === 'night-fleet')).toBe(false);

    // a second set holding other data (as another tenant, or a server, would)
    const other = structuredClone(seed) as typeof seed;
    other.fleets = [
      ...other.fleets,
      { id: 'night-fleet', name: 'Night Fleet', color: '#000000', liveId: undefined } as never,
    ];
    const dataset = JSON.stringify(other);
    const fleets = JSON.stringify({ 'night-fleet': { mapId: null, groups: [] } });
    const m = memoryStorage({ [DATASET_KEY]: dataset, [FLEETS_KEY]: fleets });
    setServices(createDummyServices({ backend: m.backend }));

    expect(datasetStore.getState().fleets.some((f) => f.id === 'night-fleet')).toBe(true);
    expect(Object.keys(fleetsStore.getState().profiles)).toEqual(['night-fleet']);
    expect(userDirectory.getState().users.length).toBeGreaterThan(0);
    expect(masterDataStore.getState().materials.length).toBeGreaterThan(0);
    expect(settingsStore.getState().connections['fleet-manager']).toBeTruthy();
    expect(Object.keys(wfStore.getState().workflows).length).toBeGreaterThan(0);

    await wait(450); // longer than every save delay
    expect(m.data.get(DATASET_KEY)).toBe(dataset); // not rewritten
    expect(m.data.get(FLEETS_KEY)).toBe(fleets);
    expect(m.data.has(MASTERDATA_KEY)).toBe(false); // nothing was handed back for stores that only read
    expect(m.data.has(SETTINGS_KEY)).toBe(false);

    // a change made now goes to the NEW services
    datasetStore.getState().addFleet('Day Fleet');
    await wait(450);
    expect(JSON.parse(m.data.get(DATASET_KEY)!).fleets.some((f: { name: string }) => f.name === 'Day Fleet')).toBe(
      true,
    );
  });
});
