import { baseSeedWorkflows, sampleWorkflows, routeSampleWorkflows } from '@/fixtures/workflows';
import { createNode, createStart } from './factory';
import { defaultWorkflowName } from './names';
import type { WfNode, Workflow, Workflows } from './types';
import { DEFAULT_ROBOT_TYPE, ROBOT_TYPE_LABELS } from '@/data/robotTypes';
import type { FleetId } from '@/data/fleets';
import { activeProfile } from '@/data/profile';

/** The starting workflows of the dummy data: one per seed fleet, brought up to the current shape, plus the samples. */
export const seedWorkflows = (): Workflows =>
  activeProfile().starterData ? upgradeToV7(upgradeToV6(baseSeedWorkflows())) : {};
/** The sample workflows of the demo data (none in a blank workspace). */
const samples = () => (activeProfile().starterData ? sampleWorkflows() : []);
const routeSamples = () => (activeProfile().starterData ? routeSampleWorkflows() : []);
/**
 * The Start step's Robot Type is a robot of the catalog. A value saved earlier that is not one (the old list had names such as "Sherpa Hitch" that match no robot) becomes the default robot,
 * so a trip never waits for a robot type that does not exist.
 */
export function normaliseRobots(workflows: Workflows): Workflows {
  const fix = (n: WfNode): WfNode =>
    n.t === 'start' && !ROBOT_TYPE_LABELS.includes(n.f.robot as string)
      ? { ...n, f: { ...n.f, robot: DEFAULT_ROBOT_TYPE.label } }
      : n;
  const out: Workflows = {};
  for (const [id, w] of Object.entries(workflows))
    out[id] = w.nodes.some((n) => fix(n) !== n) ? { ...w, nodes: w.nodes.map(fix) } : w;
  return out;
}
/** Adds the sample routes that are missing (a list saved before they existed). */
export function withRouteSamples(workflows: Workflows): Workflows {
  const out = { ...workflows };
  for (const w of routeSamples()) if (!out[w.id]) out[w.id] = w;
  return out;
}
/** Workflows saved before requests existed: "Request from Tablet" became "Tablet". The sample workflows are added when missing. */
export function upgradeToV5(workflows: Workflows): Workflows {
  const out: Workflows = {};
  for (const [id, w] of Object.entries(workflows))
    out[id] = {
      ...w,
      nodes: w.nodes.map((n) =>
        n.t !== 'start'
          ? n
          : { ...n, f: { ...n.f, request: n.f.request === 'Request from Tablet' ? 'Tablet' : n.f.request } },
      ),
    };
  for (const s of samples()) if (!out[s.id]) out[s.id] = s;
  return out;
}
/** The Start step no longer lists User IDs (the operators mapped to the drop-off station request) and every Confirm step has a station (the one just before it). The sample workflows are replaced by the current ones. */
export function upgradeToV6(workflows: Workflows): Workflows {
  const stationOf = (n: WfNode) => (Array.isArray(n.f.station) ? n.f.station[0] : (n.f.station as string)) ?? '';
  const fix = (list: WfNode[]): WfNode[] => {
    let last = '';
    return list.map((n, i) => {
      if (n.t === 'station') last = stationOf(n);
      const next = list.slice(i + 1).find((x) => x.t === 'station');
      const at = last || (next ? stationOf(next) : ''); // the station before it, else the one after it
      const base =
        n.t === 'start'
          ? { ...n, f: Object.fromEntries(Object.entries(n.f).filter(([k]) => k !== 'user')) }
          : n.t === 'confirm' && !n.f.station
            ? { ...n, f: { ...n.f, station: at } }
            : n;
      return base.br ? { ...base, br: { t: fix(base.br.t), o: fix(base.br.o) } } : base;
    });
  };
  const out: Workflows = {};
  for (const [id, w] of Object.entries(workflows)) out[id] = { ...w, nodes: fix(w.nodes) };
  for (const s of samples()) out[s.id] = s;
  return out;
}
/**
 * Requests are no longer tied to stations: the Start step lists the users who may request (Tablet requests) and a Tablet Confirm step lists the users who approve. Confirm steps lose their
 * station, the Weight Sensor operation (not available) becomes Dispatch Button, and the sample workflows are replaced by the current ones.
 */
export function upgradeToV7(workflows: Workflows): Workflows {
  const fix = (list: WfNode[]): WfNode[] =>
    list.map((n) => {
      const base =
        n.t === 'start'
          ? { ...n, f: { ...n.f, users: Array.isArray(n.f.users) ? n.f.users : [] } }
          : n.t === 'confirm'
            ? {
                ...n,
                f: {
                  ...Object.fromEntries(Object.entries(n.f).filter(([k]) => k !== 'station')),
                  op: n.f.op === 'Weight Sensor' ? 'Dispatch Button' : n.f.op,
                  users: Array.isArray(n.f.users) ? n.f.users : [],
                },
              }
            : n;
      return base.br ? { ...base, br: { t: fix(base.br.t), o: fix(base.br.o) } } : base;
    });
  const out: Workflows = {};
  for (const [id, w] of Object.entries(workflows)) out[id] = { ...w, nodes: fix(w.nodes) };
  for (const s of samples()) out[s.id] = s;
  return withRouteSamples(out);
}

let counter = 1;
/** A new workflow with only Start and End. Without a fleet it has no name yet (it gets one when a fleet is chosen). */
export function blankWorkflow(
  fleet: FleetId | null = null,
  takenNames: string[] = [],
  fleetName: string = fleet ?? '', // (the caller looks the name up: the seed must not depend on the fleet list, services read this file)
): Workflow {
  return {
    id: `w-${Date.now().toString(36)}-${counter++}`,
    name: fleet ? defaultWorkflowName(fleetName, takenNames) : '',
    fleet,
    nodes: [createStart(), createNode('end')],
  };
}
/** Kept workflows are the ones the user published or saved as a draft; everything else is thrown away when left. */
export const isKept = (w: Workflow) => !!(w.published || w.saved);
/** A workflow that has no fleet and nothing built yet can be reused instead of creating another blank one. */
export const isBlankDraft = (w: Workflow) => w.fleet === null && w.nodes.length === 2;
