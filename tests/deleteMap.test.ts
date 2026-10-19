import { beforeEach, describe, expect, it } from 'vitest';
import { addImportedMap, mapsStore, SYSTEM_MAPS, type FleetMap } from '../src/data/maps';
import { mapVersionsStore } from '../src/features/map-editor';
import { deleteMap, deleteRefusal } from '../src/features/maps/model/deleteMap';
import { setServices, services } from '../src/services';
import { createDummyServices } from '../src/services/dummy';
import { memoryStorage } from './helpers/memoryStorage';

const imported: FleetMap = {
  id: 'imp-test',
  name: 'Imported test',
  version: 5,
  tag: 'v5',
  fleetLive: '',
  updatedAt: 1,
  stations: [],
  source: 'imported',
};

describe('deleting a map', () => {
  beforeEach(() => {
    setServices(createDummyServices({ backend: memoryStorage().backend, sessionBackend: memoryStorage().backend }));
    mapsStore.setState({ maps: [...SYSTEM_MAPS] });
    mapVersionsStore.setState({ byMap: {} });
  });
  it('refuses a map a fleet runs on, and the built-in maps', () => {
    expect(deleteRefusal(imported, ['Line Side Fleet'])).toBe('assigned');
    expect(deleteRefusal(SYSTEM_MAPS[0], [])).toBe('built-in');
    expect(deleteRefusal(imported, [])).toBeNull();
  });
  it('removes an unassigned imported map, its versions and its stored files', async () => {
    const assetId = await services().mapAssets.put(new Uint8Array([1, 2, 3]), 'image/png');
    addImportedMap(imported);
    mapVersionsStore.setState({
      byMap: {
        [imported.id]: {
          versions: [
            {
              id: 'v',
              mapId: imported.id,
              status: 'draft',
              number: null,
              basedOn: null,
              createdAt: 1,
              createdBy: 'x',
              data: { nodes: [], lanes: [], roads: [], stations: [], stagingAreas: [], zones: [], source: { assetId } },
            },
          ],
        },
      } as never,
    });
    expect(await deleteMap(imported, ['Fleet'])).toBe('assigned');
    expect(mapsStore.getState().maps.some((m) => m.id === imported.id)).toBe(true);
    expect(await deleteMap(imported, [])).toBeNull();
    expect(mapsStore.getState().maps.some((m) => m.id === imported.id)).toBe(false);
    expect(mapVersionsStore.getState().byMap[imported.id]).toBeUndefined();
    expect(await services().mapAssets.get(assetId)).toBeFalsy();
    expect(await deleteMap(SYSTEM_MAPS[0], [])).toBe('built-in');
    expect(mapsStore.getState().maps).toHaveLength(SYSTEM_MAPS.length);
  });
});
