import { FLEET_ID, asFleetId } from '../src/data/fleets';
import { datasetStore } from '../src/data/dataset';
import { describe, expect, it } from 'vitest';
import {
  addGroup,
  addToGroup,
  deleteGroup,
  freeStations,
  pruneMaterial,
  removeFromGroup,
  renameGroup,
  stationsOfMaterial,
  validateGroupForm,
} from '../src/features/fleets/model/logic';
import { SYSTEM_MAPS as MAPS, mapById } from '../src/features/maps/model/maps';
import { SEED_PROFILES } from '../src/fixtures/fleetProfiles';
import { EMPTY_PROFILE } from '../src/features/fleets/model/store';
import { workflowSummary } from '../src/features/fleets/model/workflows';
import { fleetPath } from '../src/features/fleets/paths';
import { KINDS } from '../src/features/devices/model/kinds';
import { seedGroups, seedMaterials } from '../src/fixtures/masterData';
import { assignToFleet, unassignFromFleet } from '../src/features/master-data/model/logic';
import { createNode, createStart } from '../src/features/workflow-builder/model/factory';

const lineSide = SEED_PROFILES[FLEET_ID.lineSide];
const map = mapById(lineSide.mapId)!;

describe('fleet profiles: each fleet has its own data', () => {
  it('fleets point at different maps with their own stations and groups', () => {
    expect(map.name).toBe('Main_Assembly_Hall_Engine_Bay_All');
    expect(mapById(SEED_PROFILES[FLEET_ID.assembly].mapId)!.stations.map((s) => s.name)).not.toEqual(
      map.stations.map((s) => s.name),
    );
    expect(lineSide.groups.map((g) => g.name)).not.toEqual(SEED_PROFILES[FLEET_ID.assembly].groups.map((g) => g.name));
    expect(EMPTY_PROFILE).toEqual({ mapId: null, groups: [] });
  });
  it('every seeded group sits on a station of its own map and only holds materials assigned to that fleet', () => {
    const groups = seedGroups(0);
    const materials = seedMaterials(0, groups);
    for (const [fleet, p] of Object.entries(SEED_PROFILES))
      for (const g of p.groups) {
        expect(mapById(p.mapId)!.stations.some((s) => s.id === g.stationId)).toBe(true);
        g.codes.forEach((c) => expect(materials.find((m) => m.code === c)!.fleets).toContain(fleet));
      }
  });
  it('robots and hardware are spread over fleets in the seed (including unassigned)', () => {
    const by = (list: { values: Record<string, unknown> }[], f: string) =>
      list.filter((d) => d.values.fleet === f).length;
    expect(by(KINDS.robot.seed, FLEET_ID.lineSide)).toBe(9);
    expect(by(KINDS.robot.seed, FLEET_ID.assembly)).toBe(9);
    expect(by(KINDS.robot.seed, '')).toBe(1);
    expect(by(KINDS.hardware.seed, FLEET_ID.lineSide)).toBe(2);
    expect(by(KINDS.hardware.seed, FLEET_ID.assembly)).toBe(1);
  });
  it('fleet urls hold the fleet id', () =>
    expect(fleetPath(FLEET_ID.lineSide, 'materials')).toBe('/configurator/fleets/line-side/materials'));
  it('every map has stations with unique ids', () =>
    MAPS.forEach((m) => expect(new Set(m.stations.map((s) => s.id)).size).toBe(m.stations.length)));
});

describe('station groups', () => {
  it('free stations exclude grouped ones; one group per station', () => {
    expect(freeStations(map, lineSide.groups).map((s) => s.id)).toEqual(['ST-03', 'ST-04']);
    expect(freeStations(null, [])).toEqual([]);
    expect(validateGroupForm({ name: 'X', stationId: 'ST-01', codes: ['A'] }, lineSide.groups).stationId).toMatch(
      /already has a group/,
    );
  });
  it('validation: name, station, at least one material; rename keeps its own name', () => {
    expect(Object.keys(validateGroupForm({ name: '', stationId: '', codes: [] }, [])).sort()).toEqual([
      'codes',
      'name',
      'stationId',
    ]);
    expect(validateGroupForm({ name: 'kitting area', stationId: 'ST-03', codes: ['A'] }, lineSide.groups).name).toMatch(
      /already exists/,
    );
    expect(validateGroupForm({ name: 'Kitting Area', stationId: '', codes: [] }, lineSide.groups, 'ST-02')).toEqual({});
  });
  it('create / rename / add / remove / delete / prune', () => {
    let g = addGroup(lineSide.groups, { name: ' Packing Zone ', stationId: 'ST-04', codes: ['DCP-1004'] });
    expect(g.at(-1)).toMatchObject({ id: 'ST-04', name: 'Packing Zone' });
    g = renameGroup(g, 'ST-04', 'Packing');
    g = addToGroup(g, 'ST-04', ['DCP-1004', 'DCP-1001']);
    expect(g.at(-1)!.codes).toEqual(['DCP-1004', 'DCP-1001']);
    expect(stationsOfMaterial(g, 'DCP-1001')).toEqual(['ST-01', 'ST-04']);
    expect(removeFromGroup(g, 'ST-04', 'DCP-1001').at(-1)!.codes).toEqual(['DCP-1004']);
    expect(stationsOfMaterial(pruneMaterial(g, 'DCP-1001'), 'DCP-1001')).toEqual([]);
    expect(deleteGroup(g, 'ST-04')).toHaveLength(lineSide.groups.length);
    expect(lineSide.groups).toHaveLength(2); // the seed is never mutated
  });
});

describe('fleet materials assignment (master data helpers)', () => {
  it('assign adds the fleet once; unassign removes only that fleet', () => {
    const list = seedMaterials(0, seedGroups(0));
    const a = assignToFleet(list, ['DCP-1005'], FLEET_ID.lineSide, 1);
    expect(a.find((m) => m.code === 'DCP-1005')!.fleets).toEqual([FLEET_ID.assembly, FLEET_ID.lineSide]);
    expect(assignToFleet(a, ['DCP-1005'], FLEET_ID.lineSide, 2)).toEqual(a);
    expect(unassignFromFleet(a, 'DCP-1005', FLEET_ID.assembly, 3).find((m) => m.code === 'DCP-1005')!.fleets).toEqual([
      FLEET_ID.lineSide,
    ]);
  });
});

describe('workflows tab summary', () => {
  it('reads materials, trigger and published state from the builder workflow', () => {
    const logic = createNode('logic', { material: 'B-2' });
    const nodes = [
      createStart({ request: 'Call Button' }),
      createNode('material', { code: 'A-1' }),
      createNode('material', { code: 'A-1' }),
      logic,
      createNode('end'),
    ];
    expect(workflowSummary({ id: 'x', name: 'w', fleet: asFleetId('f'), nodes })).toEqual({
      id: 'x',
      name: 'w',
      nodes: 7,
      materials: ['A-1', 'B-2'],
      trigger: 'Call Button',
      published: false,
    });
    expect(workflowSummary({ id: 'x', name: 'w', fleet: asFleetId('f'), nodes, published: true }).published).toBe(true);
  });
});

const BRAND_NEW = asFleetId('brand-new');
describe('assigning a map', () => {
  it('a fleet without a map can be given one; changing the map clears station groups of the old map', async () => {
    const { fleetsStore, profileOf } = await import('../src/features/fleets/model/store');
    expect(profileOf(fleetsStore.getState().profiles, BRAND_NEW).mapId).toBeNull();
    fleetsStore.getState().assignMap(BRAND_NEW, 'assembly-east'); // the Assembly Fleet has it: a map belongs to one fleet, so nothing happens
    expect(profileOf(fleetsStore.getState().profiles, BRAND_NEW).mapId).toBeNull();
    fleetsStore.getState().unassignMap(FLEET_ID.assembly);
    fleetsStore.getState().assignMap(BRAND_NEW, 'assembly-east');
    expect(profileOf(fleetsStore.getState().profiles, BRAND_NEW)).toEqual({
      mapId: 'assembly-east',
      groups: [],
    });
    fleetsStore.getState().assignMap(FLEET_ID.lineSide, 'main-assembly');
    expect(profileOf(fleetsStore.getState().profiles, FLEET_ID.lineSide).groups).toHaveLength(2); // same map: untouched
    fleetsStore.getState().unassignMap(BRAND_NEW);
    fleetsStore.getState().assignMap(FLEET_ID.lineSide, 'assembly-east');
    expect(profileOf(fleetsStore.getState().profiles, FLEET_ID.lineSide).groups).toEqual([]);
  });
});

describe('renaming a fleet', () => {
  it("changes only the fleet list: everything else points at the fleet's id and keeps working; refuses empty and duplicate names", async () => {
    const { renameFleet } = await import('../src/features/fleets/model/rename');
    const { wfStore } = await import('../src/features/workflow-builder/model/store');
    const { deviceStore } = await import('../src/features/devices/model/store');
    const { masterDataStore } = await import('../src/features/master-data/model/store');
    const { fleetsStore } = await import('../src/features/fleets/model/store');
    expect(renameFleet(FLEET_ID.lineSide, '  ')).toMatch(/needs a name/);
    expect(renameFleet(FLEET_ID.lineSide, 'assembly fleet')).toMatch(/already exists/);
    const before = JSON.stringify([
      wfStore.getState().workflows,
      deviceStore.getState().robot,
      masterDataStore.getState().materials,
      fleetsStore.getState().profiles,
    ]);
    expect(renameFleet(FLEET_ID.lineSide, ' Line Feeding ')).toBe('');
    expect(datasetStore.getState().fleets.map((f) => f.name)).toContain('Line Feeding');
    expect(datasetStore.getState().fleets.map((f) => f.name)).not.toContain('Line Side Fleet');
    // nothing but the fleet list was touched
    expect(
      JSON.stringify([
        wfStore.getState().workflows,
        deviceStore.getState().robot,
        masterDataStore.getState().materials,
        fleetsStore.getState().profiles,
      ]),
    ).toBe(before);
    expect(deviceStore.getState().robot.filter((d) => d.values.fleet === FLEET_ID.lineSide)).toHaveLength(9);
    expect(masterDataStore.getState().materials.filter((m) => m.fleets.includes(FLEET_ID.lineSide))).toHaveLength(4);
    expect(renameFleet(FLEET_ID.lineSide, 'line feeding')).toBe(''); // changing only the case of its own name is fine
  });
});

import { filterSortMaps, fleetsByMap, validateNewMap } from '../src/features/maps/model/logic';
import { DEFAULT_ROUTING, ROUTING_VERSIONS, routingName } from '../src/features/maps/model/routing';
describe('maps page logic', () => {
  const msg = {
    name: 'n',
    nameTaken: (x: string) => `taken ${x}`,
    robot: 'r',
    runData: 'd',
    version: 'v',
    z: 'z',
    number: 'num',
  };
  const ok = { name: 'floor_1', robot: 'AMR-001', runData: 'run', version: 'v5', zMin: '', zMax: '' };
  it('only the system maps are listed; fleets per map come from fleet profiles', () => {
    const by = fleetsByMap(
      { A: { mapId: 'main-assembly' }, B: { mapId: 'main-assembly' }, C: { mapId: null } },
      (id) => id,
    );
    expect(by).toEqual({ 'main-assembly': ['A', 'B'] });
    expect(filterSortMaps(MAPS, by, '', 'name').map((m) => m.id)).toEqual(['assembly-east', 'main-assembly']);
    expect(filterSortMaps(MAPS, by, '', 'version')[0].version).toBe(5);
    // most recently worked on first: an edit newer than the map's own time counts
    const recent = new Map([['assembly-east', Date.now() + 1000]]);
    expect(filterSortMaps(MAPS, by, '', 'updated', (m) => recent.get(m.id) ?? m.updatedAt)[0].id).toBe('assembly-east');
    expect(filterSortMaps(MAPS, by, 'engine', 'name').map((m) => m.id)).toEqual(['main-assembly']);
    expect(filterSortMaps(MAPS, by, 'zzz', 'name')).toEqual([]);
  });
  it('Generate Map form: required fields, unique name, numeric z bounds with min < max', () => {
    expect(validateNewMap(ok, MAPS, msg)).toEqual({});
    expect(validateNewMap({ ...ok, name: ' ', robot: '', runData: '', version: '' }, MAPS, msg)).toEqual({
      name: 'n',
      robot: 'r',
      runData: 'd',
      version: 'v',
    });
    expect(validateNewMap({ ...ok, name: 'assembly_hall_east_all' }, MAPS, msg).name).toMatch(/taken/);
    expect(validateNewMap({ ...ok, zMin: '3', zMax: '1' }, MAPS, msg).zMax).toBe('z');
    expect(validateNewMap({ ...ok, zMin: 'x' }, MAPS, msg).zMin).toBe('num');
    expect(validateNewMap({ ...ok, zMin: '0.5', zMax: '3' }, MAPS, msg)).toEqual({});
  });
  it('v5 is the recommended default routing', () => {
    expect(DEFAULT_ROUTING).toBe('v5');
    expect(ROUTING_VERSIONS.map((r) => r.id)).toEqual(['v2', 'v4', 'v5']);
    expect(routingName(5)).toBe('Dynamic Routing');
  });
});
