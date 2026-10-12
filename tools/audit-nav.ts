// Usage: npx vite-node tools/audit-nav.ts public/sites/<id>/nav.json
import { readFileSync } from 'node:fs';
import { auditNav } from '../src/core/audit';
import type { NavGraph } from '../src/core/types';

const file = process.argv[2]; if (!file) { console.error('usage: vite-node tools/audit-nav.ts <nav.json>'); process.exit(1); }
const a = auditNav(JSON.parse(readFileSync(file, 'utf8')) as NavGraph);
console.log(`${a.lanes} lanes, ${a.intersections} intersections (largest ${a.largestIntersection} points)`);
console.log(`narrow lanes: ${Math.round(a.narrowShare * 100)}% (narrowest ${a.narrowestLane.toFixed(2)} m)`);
console.log(`busiest intersections: ${a.hubs.map((h) => `${h.id} ${Math.round(h.share * 100)}%`).join(', ')}`);
console.log(a.warnings.length ? '\nWarnings:\n- ' + a.warnings.join('\n- ') : '\nNo problems found.');
