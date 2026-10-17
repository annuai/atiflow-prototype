import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sceneIndexes, sliceNetwork } from '../src/core/scene';
import type { NavGraph, SiteLayout } from '../src/core/types';
import type { FleetRecord } from '../src/data/fleets';
import type { FleetMap } from '../src/data/maps';
import { buildWorld, type WorldInput } from '../src/features/live-floor/world/buildWorld';
import { sceneOfFleet, visibleScenes } from '../src/features/live-floor/world/scenes';
import type { MapData } from '../src/features/map-editor';

const baseSite = JSON.parse(readFileSync('public/sites/ecc/site.json', 'utf8')) as SiteLayout;
const baseNav = JSON.parse(readFileSync('public/sites/ecc/nav.json', 'utf8')) as NavGraph;
const lineSide: FleetRecord = { id: 'line-side', name: 'Line Side Fleet', color: '#14b8a6', liveId: 'line-side' };
const assembly: FleetRecord = { id: 'assembly', name: 'Assembly Fleet', color: '#f59e0b', liveId: 'asrs' };
const probe: FleetRecord = { id: 'probe', name: 'Probe Fleet', color: '#6366f1' };
const MAPS: FleetMap[] = [
  { id: 'main-assembly', name: 'Main', version: 5, tag: '', fleetLive: 'line-side', updatedAt: 0, stations: [] },
  { id: 'assembly-east', name: 'East', version: 2, tag: '', fleetLive: 'asrs', updatedAt: 0, stations: [] },
];
const imported: FleetMap = {
  id: 'imp-x',
  name: 'x',
  version: 5,
  tag: '',
  fleetLive: '',
  updatedAt: 0,
  stations: [],
  source: 'imported',
};
const tiny = (): MapData => ({
  nodes: [
    { id: 'N-STA-901', x: 0, y: 0, kind: 'station' },
    { id: 'N-STA-902', x: 20, y: 0, kind: 'station' },
  ],
  lanes: [
    {
      id: 'L1',
      from: 'N-STA-901',
      to: 'N-STA-902',
      geom: [
        [0, -0.5],
        [20, -0.5],
      ],
      fleets: [''],
      speed: 1,
      len: 20,
    },
    {
      id: 'L2',
      from: 'N-STA-902',
      to: 'N-STA-901',
      geom: [
        [20, 0.5],
        [0, 0.5],
      ],
      fleets: [''],
      speed: 1,
      len: 20,
    },
  ],
  roads: [],
  stations: [
    { id: 'STA-901', name: 'A', nodeId: 'N-STA-901', type: 'drop', zone: null, fleets: [''] },
    { id: 'STA-902', name: 'B', nodeId: 'N-STA-902', type: 'drop', zone: null, fleets: [''] },
  ],
  stagingAreas: [],
  zones: [],
  structure: {
    walls: [{ a: [0, 0], b: [20, 0], t: 0.2, h: 3, layer: 'grid' }],
    equipment: [],
  },
});
const input = (o: Partial<WorldInput> & { fleets: FleetRecord[] }): WorldInput => ({
  baseSite,
  baseNav,
  profiles: { 'Line Side Fleet': { mapId: 'main-assembly' }, 'Assembly Fleet': { mapId: 'assembly-east' } },
  maps: MAPS,
  published: () => null,
  structure: (d) => (d.structure ? { ...d.structure, floorPolygons: [] } : null),
  ...o,
});
const ecc = () => buildWorld(input({ fleets: [lineSide, assembly] }));
const withImported = (data = tiny()) =>
  buildWorld(
    input({
      fleets: [lineSide, assembly, probe],
      maps: [...MAPS, imported],
      profiles: { ...input({ fleets: [] }).profiles, 'Probe Fleet': { mapId: 'imp-x' } },
      published: (id) => (id === 'imp-x' ? data : null),
    }),
  );

describe('one scene per fleet, and one for the whole floor', () => {
  it('each ECC fleet has its own scene with only the lanes it drives', () => {
    const w = ecc();
    expect(w.scenes.map((s) => s.fleetId).sort()).toEqual(['asrs', 'line-side']);
    const ls = sceneOfFleet(w, 'line-side')!,
      as = sceneOfFleet(w, 'asrs')!;
    expect(ls.key).not.toBe(as.key);
    expect(ls.network.lanes.length).not.toBe(as.network.lanes.length);
    expect(ls.network.lanes.every((l) => l.fleets.includes('line-side'))).toBe(true);
    expect(as.network.lanes.every((l) => l.fleets.includes('asrs'))).toBe(true);
    expect(ls.fleets).toEqual(['line-side']);
  });

  it('a lane in a shared area is in both scenes; a lane of one fleet only in its own', () => {
    const w = ecc();
    const ls = sceneOfFleet(w, 'line-side')!,
      as = sceneOfFleet(w, 'asrs')!;
    const lsOnly = ls.network.lanes.filter((l) => l.fleets.length === 1);
    expect(lsOnly.length).toBeGreaterThan(50);
    expect(lsOnly.every((l) => !as.network.lanes.some((q) => q.id === l.id))).toBe(true);
    const shared = ls.network.lanes.filter((l) => l.fleets.length > 1);
    expect(shared.length).toBeGreaterThan(0);
    expect(shared.every((l) => as.network.lanes.some((q) => q.id === l.id))).toBe(true);
  });

  it('two fleets on the SAME map are two scenes, each loaded for its own fleet (nothing is shared)', () => {
    const w = buildWorld(
      input({
        fleets: [lineSide, assembly, probe],
        profiles: { ...input({ fleets: [] }).profiles, 'Probe Fleet': { mapId: 'main-assembly' } },
      }),
    );
    expect(w.scenes).toHaveLength(3);
    const a = sceneOfFleet(w, 'probe')!,
      b = sceneOfFleet(w, 'line-side')!;
    expect(a).not.toBe(b);
    expect(a.key).not.toBe(b.key);
    expect(a.mapId).toBe(b.mapId);
    expect(a.fleets).toEqual(['probe']);
    expect(a.network.lanes.length).toBe(b.network.lanes.length); // the same map: the same lanes, tagged for this fleet
    expect(a.network.lanes.every((l) => l.fleets.includes('probe'))).toBe(true);
  });

  it('an imported map is its own scene: its own building, placed beside the ECC floor, ids prefixed', () => {
    const w = withImported();
    const s = sceneOfFleet(w, 'probe')!;
    expect(s.mapId).toBe('imp-x');
    expect(s.site.walls).toHaveLength(1);
    expect(s.site.bounds.minX).toBeGreaterThan(baseSite.bounds.maxX); // just its own box, not the union
    expect(s.placement.x).toBeGreaterThan(baseSite.bounds.maxX);
    expect(s.network.lanes.map((l) => l.id).sort()).toEqual(['imp-x/L1', 'imp-x/L2']);
    expect(s.network.forbiddenZones).toEqual([]); // the ECC no-go zones are not this map's
  });

  it('"all fleets" is ONE scene: every fleet, every building', () => {
    const w = withImported();
    expect(w.all.fleetId).toBeNull();
    expect(w.all.fleets.sort()).toEqual(['asrs', 'line-side', 'probe']);
    expect(w.all.site.bounds.maxX).toBeGreaterThan(baseSite.bounds.maxX + 20);
    expect(w.all.network.lanes.length).toBe(w.nav.lanes.length);
  });
});

describe('what is shown for a choice of fleet', () => {
  it('a fleet shows its own scene; all fleets and a fleet that is not on the floor show the whole floor', () => {
    const w = withImported();
    expect(visibleScenes(w, 'asrs').map((s) => s.fleetId)).toEqual(['asrs']);
    expect(visibleScenes(w, 'all')).toEqual([w.all]);
    expect(visibleScenes(w, 'nobody')).toEqual([w.all]);
  });
});

describe('a fleet that is added later', () => {
  it('gets its own scene, and a scene that does not involve it is not touched', () => {
    const before = withImported();
    const after = buildWorld(
      input({
        fleets: [lineSide, assembly, probe, { id: 'late', name: 'Late Fleet', color: '#ec4899' }],
        maps: [...MAPS, imported],
        profiles: {
          ...input({ fleets: [] }).profiles,
          'Probe Fleet': { mapId: 'imp-x' },
          'Late Fleet': { mapId: 'assembly-east' },
        },
        published: (id) => (id === 'imp-x' ? tiny() : null),
      }),
    );
    expect(after.scenes.map((s) => s.fleetId).sort()).toEqual(['asrs', 'late', 'line-side', 'probe']);
    const late = sceneOfFleet(after, 'late')!;
    expect(late.mapId).toBe('assembly-east');
    expect(late.network.lanes.every((l) => l.fleets.includes('late'))).toBe(true);
    // the imported map's scene is exactly what it was: nothing to reload for it
    expect(sceneOfFleet(after, 'probe')!.key).toBe(sceneOfFleet(before, 'probe')!.key);
    // the whole floor changed (a fleet joined it)
    expect(after.all.key).not.toBe(before.all.key);
  });

  it('a fleet with no map is not a scene and is listed as idle, never half-loaded', () => {
    const w = buildWorld(input({ fleets: [lineSide, assembly, probe] }));
    expect(sceneOfFleet(w, 'probe')).toBeNull();
    expect(w.idle.map((i) => i.fleetId)).toEqual(['probe']);
  });
});

describe('keys say exactly what changed', () => {
  it('the same inputs give the same keys', () => {
    expect(ecc().scenes.map((s) => s.key)).toEqual(ecc().scenes.map((s) => s.key));
  });
  it('publishing a map with another road changes that scene’s key', () => {
    const a = sceneOfFleet(withImported(), 'probe')!;
    const longer = tiny();
    longer.lanes[0] = {
      ...longer.lanes[0],
      geom: [
        [0, -0.5],
        [10, -0.5],
        [20, -0.5],
      ],
    };
    const b = sceneOfFleet(withImported(longer), 'probe')!;
    expect(b.key).not.toBe(a.key);
  });
});

describe('derived indexes are built once per scene', () => {
  it('the same model gives the same lookups, and they can route between its stations', () => {
    const s = sceneOfFleet(withImported(), 'probe')!;
    const i = sceneIndexes(s);
    expect(sceneIndexes(s)).toBe(i);
    expect(i.lanes.route(s.network.stations[0].nodeId, s.network.stations[1].nodeId, 'probe')).not.toBeNull();
    expect(i.rules.fleetAllowed('probe', 5, 0)).toBe(true);
  });
  it('slicing keeps only the fleet’s lanes, stations and the nodes they use', () => {
    const w = ecc();
    const n = sliceNetwork(w.nav, ['asrs'], { mapId: 'assembly-east', imported: false });
    expect(n.lanes.every((l) => l.fleets.includes('asrs'))).toBe(true);
    const nodes = new Set(n.nodes.map((q) => q.id));
    expect(n.lanes.every((l) => nodes.has(l.from) && nodes.has(l.to))).toBe(true);
    expect(n.stations.every((s) => nodes.has(s.nodeId))).toBe(true);
  });
});
