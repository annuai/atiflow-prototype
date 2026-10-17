/**
 * Draws a traffic zone at EVERY junction of a lane map (`nav.json`), replacing the sample zones: wherever lanes of different flows meet, cross or split, a zone covers the junction.
 * A zone holds ONE robot at a time (capacity 1): a robot that enters blocks it until it has left, and the next robot waits at the hold point (decided live by the fleet, never planned in advance).
 *
 *   npx vite-node tools/derive-zones/derive-zones.ts public/sites/ecc/nav.json [--margin 1.6] [--dry]
 *
 * Run it after `derive_lanes.py` (which writes sample zones) or after the lanes change.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { LaneGraph } from '../../src/core/lanes';
import { junctionZones } from '../../src/core/junctions';
import type { NavGraph } from '../../src/core/types';

const args = process.argv.slice(2);
const path = args.find((a) => !a.startsWith('--'));
if (!path) throw new Error('usage: derive-zones.ts <nav.json> [--margin m] [--dry]');
const mi = args.indexOf('--margin');
const margin = mi >= 0 ? Number(args[mi + 1]) : 1.2;
const nav = JSON.parse(readFileSync(path, 'utf8')) as NavGraph;
const zones = junctionZones(new LaneGraph(nav), margin);
console.log(`${zones.length} junctions -> traffic zones (was ${nav.trafficZones.length})`);
if (!args.includes('--dry')) {
  nav.trafficZones = [...zones, ...nav.trafficZones.filter((z) => z.gate)]; // Line gates drawn by hand are kept
  writeFileSync(path, JSON.stringify(nav));
  console.log(`written to ${path}`);
}
