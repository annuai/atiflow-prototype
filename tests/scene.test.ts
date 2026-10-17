import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { geometryKey, sceneIndexes, sliceNetwork } from '../src/core/scene';
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

describe('one scene per running map', () => {
  it('each ECC fleet has its own scene: same building, different network', () => {
    const w = ecc();
    expect(w.scenes.map((s) => s.mapId).sort()).toEqual(['assembly-east', 'main-assembly']);
    const [a, b] = w.scenes;
    expect(a.geometry.key).toBe(b.geometry.key); // one building, loaded once
    expect(a.key).not.toBe(b.key);
    expect(a.network.lanes.length).not.toBe(b.network.lanes.length);
    for (const s of w.scenes)
      expect(s.network.lanes.every((l) => l.fleets.some((f) => s.fleets.includes(f)))).toBe(true);
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

  it('a fleet that shares an ECC map is in that map’s scene (nothing to reload between them)', () => {
    const w = buildWorld(
      input({
        fleets: [lineSide, assembly, probe],
        profiles: { ...input({ fleets: [] }).profiles, 'Probe Fleet': { mapId: 'main-assembly' } },
      }),
    );
    expect(sceneOfFleet(w, 'probe')).toBe(sceneOfFleet(w, 'line-side'));
    expect(sceneOfFleet(w, 'probe')!.fleets.sort()).toEqual(['line-side', 'probe']);
    expect(w.scenes).toHaveLength(2);
  });

  it('an imported map is a third scene with its own building, placed beside the ECC floor', () => {
    const w = withImported();
    const s = sceneOfFleet(w, 'probe')!;
    expect(s.mapId).toBe('imp-x');
    expect(s.geometry.key).not.toBe(ecc().scenes[0].geometry.key);
    expect(s.geometry.site.walls).toHaveLength(1);
    expect(s.geometry.site.bounds.minX).toBeGreaterThan(baseSite.bounds.maxX); // just its own box, not the union
    expect(s.placement.x).toBeGreaterThan(baseSite.bounds.maxX);
    expect(s.network.lanes.map((l) => l.id).sort()).toEqual(['imp-x/L1', 'imp-x/L2']);
    expect(s.network.forbiddenZones).toEqual([]); // the ECC no-go zones are not this map's
  });

  it('adding a map does not change the other scenes (their keys stay, so nothing reloads)', () => {
    const before = ecc()
      .scenes.map((s) => s.key)
      .sort();
    const after = withImported()
      .scenes.filter((s) => s.mapId !== 'imp-x')
      .map((s) => s.key)
      .sort();
    expect(after).toEqual(before);
  });
});

describe('what is shown for a choice of fleet', () => {
  it('a fleet shows its own scene; "all" shows every scene; a fleet that is not on the floor shows all', () => {
    const w = withImported();
    expect(visibleScenes(w, 'asrs').map((s) => s.mapId)).toEqual(['assembly-east']);
    expect(visibleScenes(w, 'all')).toHaveLength(3);
    expect(visibleScenes(w, 'nobody')).toHaveLength(3);
  });
});

describe('keys say exactly what changed', () => {
  it('the building key follows the walls, not the network', () => {
    const moved: SiteLayout = {
      ...baseSite,
      walls: baseSite.walls.map((w, i) => (i === 0 ? { ...w, a: [w.a[0] + 1, w.a[1]] } : w)),
    };
    expect(geometryKey(moved)).not.toBe(geometryKey(baseSite));
    expect(geometryKey(baseSite)).toBe(geometryKey({ ...baseSite }));
  });
  it('publishing a map with another road changes the scene key but not the building key', () => {
    const a = withImported().scenes.find((s) => s.mapId === 'imp-x')!;
    const longer = tiny();
    longer.lanes[0] = {
      ...longer.lanes[0],
      geom: [
        [0, -0.5],
        [10, -0.5],
        [20, -0.5],
      ],
    };
    const b = withImported(longer).scenes.find((s) => s.mapId === 'imp-x')!;
    expect(b.key).not.toBe(a.key);
    expect(b.geometry.key).toBe(a.geometry.key);
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
