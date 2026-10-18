import { services } from '@/services';
import { syncIds } from './factory';
import { defaultWorkflowName } from './names';
import {
  isKept,
  normaliseRobots,
  seedWorkflows,
  upgradeToV5,
  upgradeToV6,
  upgradeToV7,
  withRouteSamples,
} from './seed';
import type { FieldValue, WfNode, Workflows } from './types';
import { prefillUsers } from './users';
import { fleetRef } from '@/data/fleetRef';

/**
 * Reads the workflows from the `workflows` service and brings them up to date: older saved versions (v2 to v6) are upgraded, robot names that match no robot become the default robot,
 * old station names become the map's, the sample trips are added, and a browser with nothing saved starts from the service's starting set. Unsaved workflows do not survive a reload.
 */
type Saved = { workflows: Workflows; current: string | null };
const load = (): Saved => {
  const s = loadSaved();
  return { ...s, workflows: normaliseRobots(s.workflows) };
}; // whatever was loaded: robot names that match no robot become the default robot
/** What the `workflows` service holds, upgraded (older versions), repaired and topped up with the sample routes. Unsaved workflows do not survive a reload. */
function loadSaved(): Saved {
  const svc = services().workflows;
  const keep = (ws: Workflows): Workflows => Object.fromEntries(Object.entries(ws).filter(([, w]) => isKept(w)));
  const done = (workflows: Workflows): Saved => {
    Object.values(workflows).forEach((w) => syncIds(w.nodes));
    return { workflows, current: null };
  };
  try {
    const saved = svc.snapshot();
    if (saved) return done(normaliseRobots(withRouteSamples(keep(saved))));
    const legacy = svc.readLegacy?.();
    const data = legacy?.data as { workflows?: Workflows; fleetNames?: unknown; fleets?: unknown } | undefined;
    switch (legacy?.version) {
      case 6: // Confirm steps had an approval station, operators were mapped to stations
        if (data?.workflows) return done(normaliseRobots(prefillUsers(upgradeToV7(keep(data.workflows)))));
        break;
      case 5: // requestors were listed on the Start step
        if (data?.workflows) return done(normaliseRobots(prefillUsers(upgradeToV7(upgradeToV6(keep(data.workflows))))));
        break;
      case 4: // placeholder User IDs and the "Request from Tablet" type
        if (data?.workflows)
          return done(normaliseRobots(prefillUsers(upgradeToV7(upgradeToV6(upgradeToV5(keep(data.workflows)))))));
        break;
      case 3: // no saved flag; built workflows with a fleet count as saved
        if (data?.workflows && Array.isArray(data.fleetNames))
          return done(
            Object.fromEntries(
              Object.entries(data.workflows)
                .filter(([, w]) => w.fleet && w.nodes.length > 2)
                .map(([id, w]) => [id, { ...w, saved: true }]),
            ),
          );
        break;
      case 2: // one workflow per fleet, keyed by fleet name
        if (data?.fleets) {
          const workflows: Workflows = {};
          Object.entries(data.fleets as Record<string, { wf?: string; nodes: WfNode[]; published?: boolean }>).forEach(
            ([fleet, f], i) => {
              syncIds(f.nodes);
              const id = `w-v2-${i}`;
              workflows[id] = {
                id,
                fleet: fleetRef(fleet),
                nodes: f.nodes,
                published: f.published,
                saved: true,
                name: !f.wf || f.wf === 'Workflow Canvas' ? defaultWorkflowName(fleet) : f.wf,
              };
            },
          );
          return { workflows, current: null };
        }
    }
  } catch {
    /* fall through */
  }
  return { workflows: seedWorkflows(), current: null };
}
/** Workflows saved before stations came from the map used S101-style names in branches and If Logic: they are the map's STA-101 stations. */
function migrateStations(ws: Workflows): Workflows {
  const fix = (v: FieldValue): FieldValue =>
    Array.isArray(v) ? v.map((x) => String(fix(x))) : typeof v === 'string' ? v.replace(/^S(\d{3})$/, 'STA-$1') : v;
  const walk = (nodes: WfNode[]) =>
    nodes.forEach((n) => {
      if ('station' in n.f) n.f.station = fix(n.f.station);
      if (n.br) {
        walk(n.br.t);
        walk(n.br.o);
      }
    });
  Object.values(ws).forEach((w) => walk(w.nodes));
  return ws;
}
/** What the workflow store starts from, and starts from again when the services are replaced. */
export function loadWorkflows(): Saved {
  const b = load();
  migrateStations(b.workflows);
  // workflows saved with a fleet NAME point at the fleet's id from now on
  for (const w of Object.values(b.workflows)) if (w.fleet) w.fleet = fleetRef(w.fleet);
  return b;
}
