import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FleetSim } from '../src/adapters/sim';
import { junctionZones } from '../src/core/junctions';
import { pointInPoly } from '../src/core/geom';
import { LaneGraph } from '../src/core/lanes';
import type { NavGraph } from '../src/core/types';
import { gridMap } from './helpers/maps';

const nav = JSON.parse(readFileSync('public/sites/ecc/nav.json', 'utf8')) as NavGraph;

describe('a traffic zone at every junction', () => {
  it('every point where lanes of different flows meet or cross is inside a zone, and every zone holds one robot', () => {
    const g = new LaneGraph(nav);
    const stray = g.intersections
      .areas()
      .flatMap((a) => a.pts.map((p) => ({ id: a.id, p })))
      .filter(({ p }) => !nav.trafficZones.some((z) => pointInPoly(p.x, p.y, z.polygon)));
    expect(stray).toEqual([]);
    expect(nav.trafficZones.length).toBeGreaterThanOrEqual(50);
    expect(nav.trafficZones.every((z) => z.capacity === 1 && z.polygon.length >= 3 && z.fleets.length > 0)).toBe(true);
  });
  it('the zones in nav.json are the ones derived from its lanes (run `npm run derive:zones` after the lanes change)', () => {
    expect(nav.trafficZones).toEqual(junctionZones(new LaneGraph(nav)));
  });
  it('a crossing of two roads is ONE zone: the robot inside blocks it until it has left, then the next goes', () => {
    const map = gridMap({ cols: 2, rows: 2 });
    expect(map.trafficZones.length).toBeGreaterThan(0);
    const sim = new FleetSim(map, 'test', 4, 5);
    let waited = 0,
      together = 0;
    for (let t = 0; t < 600; t += 0.1) {
      sim.step(0.1);
      sim.drainEvents();
      for (const z of map.trafficZones) {
        const inside = sim.bots.filter((b) => b.locks.has(z.id) && b.handedOver <= b.s);
        if (inside.length > 1) together++;
        waited += sim.bots.filter((b) => b.waitingZone === z.id).length > 0 ? 1 : 0;
      }
    }
    expect(together).toBe(0);
    expect(waited).toBeGreaterThan(0); // somebody had to wait at a zone: the order is decided live, by who arrives first
  });
});

describe('the Live Floor follows the published maps', () => {
  it("replaces a mapped fleet's lanes, stations and zones with the map's own", async () => {
    const { applyPublishedMaps, seedMapData } = await import('../src/features/map-editor');
    const nav = JSON.parse(readFileSync('public/sites/ecc/nav.json', 'utf8')) as NavGraph;
    const site = JSON.parse(readFileSync('public/sites/ecc/site.json', 'utf8'));
    const f = nav.fleets[0].id;
    const data = seedMapData({ fleetLive: f }, site, nav);
    expect(data.zones.filter((z) => z.type === 'exclusive').length).toBeGreaterThan(0);
    data.stations[0] = { ...data.stations[0], name: 'Renamed' };
    const out = applyPublishedMaps(nav, [{ fleetLive: f, data }]);
    expect(out.stations.find((s) => s.id === data.stations[0].id)?.name).toBe('Renamed');
    expect(out.trafficZones.length).toBeGreaterThanOrEqual(nav.trafficZones.filter((z) => z.fleets.includes(f)).length);
    expect(applyPublishedMaps(nav, [])).toBe(nav);
  });
});
