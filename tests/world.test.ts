import { FLEET_ID, asFleetId } from '../src/data/fleets';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FleetSim } from '../src/adapters/sim';
import type { NavGraph, SiteLayout } from '../src/core/types';
import type { FleetRecord } from '../src/data/fleets';
import { buildWorld, type WorldInput } from '../src/features/live-floor/world/buildWorld';
import { rosterFrom } from '../src/features/live-floor/liveFeed';
import { robotRecords, robotsOnFloor } from '../src/data/robots';
import { RulesIndex } from '../src/core/rules';
import type { MapData } from '../src/features/map-editor';
import type { FleetMap } from '../src/features/maps';

const baseSite = JSON.parse(readFileSync('public/sites/ecc/site.json', 'utf8')) as SiteLayout;
const baseNav = JSON.parse(readFileSync('public/sites/ecc/nav.json', 'utf8')) as NavGraph;
const lineSide: FleetRecord = { id: FLEET_ID.lineSide, name: 'Line Side Fleet', color: '#14b8a6', liveId: 'line-side' };
const assembly: FleetRecord = { id: FLEET_ID.assembly, name: 'Assembly Fleet', color: '#f59e0b', liveId: 'asrs' };
const fresh: FleetRecord = { id: asFleetId('probe'), name: 'Probe Fleet', color: '#6366f1' };
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
/** A small imported map: a 20 m road with two stations, in its own frame (origin at 0, 0), as the Map Editor would publish it. */
const tiny = (): MapData => ({
  nodes: [
    { id: 'N1', x: 0, y: 0, kind: 'waypoint' },
    { id: 'N2', x: 20, y: 0, kind: 'waypoint' },
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
});
const input = (o: Partial<WorldInput> & { fleets: FleetRecord[] }): WorldInput => ({
  baseSite,
  baseNav,
  profiles: { [FLEET_ID.lineSide]: { mapId: 'main-assembly' }, [FLEET_ID.assembly]: { mapId: 'assembly-east' } },
  maps: MAPS,
  published: () => null,
  structure: () => null,
  ...o,
});

describe('the world of the Live Floor is built from fleets and their maps', () => {
  it('with only the two ECC fleets it is the base floor, as before', () => {
    const w = buildWorld(input({ fleets: [lineSide, assembly] }));
    expect(w.nav.fleets.map((f) => f.id).sort()).toEqual(['asrs', 'line-side']);
    expect(w.nav.lanes.length).toBeGreaterThan(300);
    expect(w.idle).toEqual([]);
  });

  it('REGRESSION: a fleet created in the Configurator and given the ECC map is on the floor, with robots and lanes it may drive', () => {
    const w = buildWorld(
      input({
        fleets: [lineSide, assembly, fresh],
        profiles: { ...input({ fleets: [] }).profiles, probe: { mapId: 'main-assembly' } },
      }),
    );
    expect(w.nav.fleets.map((f) => f.id)).toContain('probe'); // was: never in the list
    expect(w.runs.probe).toBe('main-assembly');
    expect(w.nav.lanes.filter((l) => l.fleets.includes('probe')).length).toBeGreaterThan(100); // shares the map's lanes
    expect(w.nav.stations.filter((s) => s.fleets.includes('probe')).length).toBeGreaterThan(5);
    // its robots are on the floor
    const robots = robotRecords({
      fleets: [lineSide, assembly, fresh],
      robot: [
        {
          id: 'r',
          kind: 'robot',
          status: 'online',
          values: { name: 'AMR-099', sherpaType: 'Sherpa XT Lite', fleet: 'probe' },
        },
      ] as never,
    });
    expect(
      robotsOnFloor(
        robots,
        w.nav.fleets.map((f) => f.id),
      ).map((r) => r.id),
    ).toEqual(['AMR-099']);
    expect(rosterFrom).toBeTypeOf('function');
  });

  it('a fleet with no map says so (it is not silently empty)', () => {
    const w = buildWorld(input({ fleets: [lineSide, assembly, fresh] }));
    expect(w.nav.fleets.map((f) => f.id)).not.toContain('probe');
    expect(w.idle).toEqual([{ fleetId: 'probe', name: 'Probe Fleet', why: 'no-map' }]);
  });

  it('an imported map that is only a draft is not on the floor; once published with roads it is, placed beside the base floor with its own ids', () => {
    const profiles = { probe: { mapId: 'imp-x' } };
    const draftOnly = buildWorld(input({ fleets: [lineSide, assembly, fresh], maps: [...MAPS, imported], profiles }));
    expect(draftOnly.idle[0]).toMatchObject({ fleetId: 'probe', why: 'not-published' });
    const w = buildWorld(
      input({
        fleets: [lineSide, assembly, fresh],
        maps: [...MAPS, imported],
        profiles,
        published: (id) => (id === 'imp-x' ? tiny() : null),
      }),
    );
    expect(w.idle).toEqual([]);
    expect(w.runs.probe).toBe('imp-x');
    const mine = w.nav.lanes.filter((l) => l.fleets.includes('probe'));
    expect(mine).toHaveLength(2);
    expect(mine.every((l) => l.id.startsWith('imp-x/') && l.fleets.length === 1)).toBe(true);
    expect(Math.min(...mine.flatMap((l) => l.geom.map((p) => p[0])))).toBeGreaterThan(baseSite.bounds.maxX); // beside, not on top of the ECC floor
    expect(w.nav.stations.find((s) => s.id === 'STA-901')?.fleets).toEqual(['probe']);
    expect(w.site.bounds.maxX).toBeGreaterThan(baseSite.bounds.maxX + 20);
  });

  it('an imported map with no roads cannot be driven: the fleet is idle with the reason', () => {
    const noRoads = { ...tiny(), lanes: [] };
    const w = buildWorld(
      input({
        fleets: [lineSide, assembly, fresh],
        maps: [...MAPS, imported],
        profiles: { probe: { mapId: 'imp-x' } },
        published: () => noRoads,
      }),
    );
    expect(w.idle[0]).toMatchObject({ fleetId: 'probe', why: 'no-network' });
  });

  it('the simulator really drives the new fleet on its imported map', () => {
    const w = buildWorld(
      input({
        fleets: [lineSide, assembly, fresh],
        maps: [...MAPS, imported],
        profiles: { probe: { mapId: 'imp-x' } },
        published: (id) => (id === 'imp-x' ? tiny() : null),
      }),
    );
    const sim = new FleetSim(w.nav, w.site.siteId, 1, 3, [
      { id: 'AMR-099', model: 'sherpa-xt-lite', fleetId: 'probe', batteryKWh: 2 },
    ]);
    let moved = 0;
    for (let i = 0; i < 600; i++) {
      sim.step(0.1);
      moved = Math.max(moved, sim.snapshot().find((r) => r.id === 'AMR-099')?.speed ?? 0);
    }
    expect(moved).toBeGreaterThan(0);
  });

  it('the signature changes when a fleet gains a map, so the feed knows to rebuild', () => {
    const a = buildWorld(input({ fleets: [lineSide, assembly, fresh] }));
    const b = buildWorld(
      input({
        fleets: [lineSide, assembly, fresh],
        profiles: { ...input({ fleets: [] }).profiles, probe: { mapId: 'main-assembly' } },
      }),
    );
    expect(a.signature).not.toBe(b.signature);
  });
});

describe('areas of a fleet on a shared or imported map', () => {
  it('a fleet that shares an ECC map has that map’s areas, so its robots are not "outside the map"', () => {
    const w = buildWorld(
      input({
        fleets: [lineSide, assembly, fresh],
        profiles: { ...input({ fleets: [] }).profiles, probe: { mapId: 'main-assembly' } },
      }),
    );
    const areasOf = (id: string) => w.nav.fleets.find((f) => f.id === id)!.areas;
    expect(areasOf('probe').length).toBeGreaterThan(0);
    expect(areasOf('probe')).toEqual(areasOf('line-side'));
  });
  it('a fleet on an imported map has no areas and is limited by its lanes only', () => {
    const w = buildWorld(
      input({
        fleets: [lineSide, assembly, fresh],
        maps: [...MAPS, imported],
        profiles: { probe: { mapId: 'imp-x' } },
        published: (id) => (id === 'imp-x' ? tiny() : null),
      }),
    );
    expect(w.nav.fleets.find((f) => f.id === 'probe')!.areas).toEqual([]);
    const rules = new RulesIndex(w.nav, w.site);
    expect(rules.fleetAllowed('probe', 120, 3)).toBe(true);
    expect(rules.fleetAllowed('line-side', -500, -500)).toBe(false); // an ECC fleet is still held to its areas
  });
});
