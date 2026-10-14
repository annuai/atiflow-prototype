import { LaneGraph } from '@/core/lanes';
import type { Vec2 } from '@/core/types';
import { wfStore, SIM_IDLE, selectFleet } from '../model/store';
import { liveIdOf, mapNow } from '../model/stations';
import type { WfNode } from '../model/types';

/** What the simulation tells the map: a robot driving from station to station (position + heading), the lane path of the leg being driven and of the legs already finished. The robot is only a picture of the workflow, nothing is running. */
export type Frame = { type: 'route'; cur: Vec2[] | null; done: Vec2[][] } | { type: 'robot'; p: Vec2; heading: number } | { type: 'reset' };
const listeners = new Set<(f: Frame) => void>();
export const simBus = { on(fn: (f: Frame) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }, emit(f: Frame) { listeners.forEach((l) => l(f)); } };

const CANCEL = Symbol('cancel'); let token = 0; let legsDone: Vec2[][] = []; let prevStation: string | null = null; let graph: { nav: unknown; g: LaneGraph } | null = null;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const secsOf = (t: string) => String(t).split(':').reduce((a, x) => a * 60 + (+x || 0), 0);
const fmt = (s: number) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, Math.floor(s) % 60].map((x) => String(x).padStart(2, '0')).join(':');
const S = () => wfStore.getState();
const laneGraph = () => { const m = mapNow(); if (!m) return null; if (graph?.nav !== m.nav) graph = { nav: m.nav, g: new LaneGraph(m.nav) }; return graph.g; };

export function stopSimulation() { token++; S().setSim({ ...SIM_IDLE }); legsDone = []; prevStation = null; simBus.emit({ type: 'reset' }); }

/** The point `d` metres along a path and the direction there (radians, site frame). */
function pointAlong(pts: Vec2[], d: number): { p: Vec2; heading: number } {
  let rem = d;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.y - a.y);
    if (rem <= L || i === pts.length - 1) { const t = L ? Math.min(1, rem / L) : 1; return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, heading: Math.atan2(b.y - a.y, b.x - a.x) }; }
    rem -= L;
  }
  return { p: pts[0], heading: 0 };
}
/** Drives the robot along a path (ease in and out); a reduced-motion preference jumps straight to the end. */
async function drive(pts: Vec2[], len: number, tok: number) {
  const dur = Math.min(4200, 900 + len * 45), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  await new Promise<void>((res, rej) => {
    let t0: number | null = null;
    const step = (ts: number) => {
      if (tok !== token) return rej(CANCEL); if (t0 === null) t0 = ts;
      const k = reduce ? 1 : Math.min(1, (ts - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; const { p, heading } = pointAlong(pts, e * len);
      simBus.emit({ type: 'robot', p, heading }); if (k < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
}
/** The lane path between two stations of the open fleet's map, and its length in metres (null when there is no path: the first station, or a station that is not on the map). */
function legBetween(from: string | null, to: string): { pts: Vec2[]; len: number } | null {
  const g = laneGraph(), fleet = liveIdOf(selectFleet(S())); const a = from ? g?.stationNode(from) : null, b = g?.stationNode(to); if (!g || !fleet || !a || !b || a.id === b.id) return null;
  const lanes = g.route(a.id, b.id, fleet); if (!lanes?.length) return null; const plan = g.plan(lanes, { x: a.x, y: a.y }); return { pts: plan.pts.map((p) => ({ x: p.x, y: p.y })), len: plan.total };
}
async function pause(ms: number, tok: number) { await sleep(ms); if (tok !== token) throw CANCEL; }

/** Walks the workflow exactly as built: Start -> Material (sets quantity) -> If Logic (evaluates, takes TRUE/OTHERWISE) -> Stations (robot drives) -> Container/Wait/Confirm (pause) -> End. */
export async function runSimulation(nodes: WfNode[]) {
  stopSimulation(); const tok = token; await import('../model/stations').then((m) => m.loadMap()); if (tok !== token) return;
  S().setSim({ ...SIM_IDLE, status: 'running' }); simBus.emit({ type: 'reset' });
  const qty: Record<string, number> = {}; let done = 0;
  const total = nodes.length + Math.max(0, ...nodes.filter((n) => n.br).map((n) => Math.max(n.br!.t.length, n.br!.o.length)));
  const say = (step: string) => S().setSim({ step });
  const mark = (id: string) => { done++; S().setSim({ visited: [...S().sim.visited, id], progress: Math.min(100, (done / total) * 100) }); };
  async function visit(n: WfNode): Promise<void> {
    if (tok !== token) throw CANCEL; S().setSim({ currentId: n.id }); const f = n.f as Record<string, any>;
    switch (n.t) {
      case 'start': say(`Start: ${f.trigger} trigger, ${f.robot}, ${f.request}`); await pause(900, tok); break;
      case 'material': { const q = f.fromTablet ? 5 + Math.floor(Math.random() * 16) : +f.qty || 0; qty[f.code] = (qty[f.code] || 0) + q;
        say(f.fromTablet ? `Material: operator entered ${q} × ${f.code} on the tablet` : `Material: ${q} × ${f.code}`); await pause(1000, tok); break; }
      case 'logic': { const have = qty[f.material] || 0, lim = +f.qty || 0;
        const ok = ({ 'Greater than': have > lim, 'Less than': have < lim, 'Equal to': have === lim, 'Not equal to': have !== lim } as Record<string, boolean>)[f.cond];
        const b = ok ? 't' : 'o'; S().setSim({ taken: { ...S().sim.taken, [n.id]: b } });
        say(`If ${f.material} quantity ${have} is ${String(f.cond).toLowerCase()} ${lim}: ${ok ? 'TRUE' : 'OTHERWISE'} branch`); await pause(1500, tok); mark(n.id);
        for (const x of n.br![b]) await visit(x); return; }
      case 'station': { const list: string[] = (Array.isArray(f.station) ? f.station : [f.station]).filter(Boolean);
        for (const st of list) {
          const known = !!laneGraph()?.station(st); S().setSim({ hlStation: st });
          if (!known) { say(`${st || 'This step'} isn't on the map, skipping it`); await pause(1100, tok); continue; }
          const leg = legBetween(prevStation, st); const verb = f.action === 'Pick Up' ? 'pick up at' : 'drop off at';
          if (leg) { simBus.emit({ type: 'route', cur: leg.pts, done: legsDone }); say(`Driving to ${verb} ${st}: ${Math.round(leg.len)} m`); await drive(leg.pts, leg.len, tok); legsDone = [...legsDone, leg.pts]; simBus.emit({ type: 'route', cur: null, done: legsDone }); }
          else { const at = laneGraph()!.stationNode(st)!; simBus.emit({ type: 'robot', p: { x: at.x, y: at.y }, heading: 0 }); say(`Starting at ${st}`); await pause(500, tok); }
          say(`${f.action === 'Pick Up' ? 'Picked up at' : 'Dropped off at'} ${st}`); await pause(700, tok); prevStation = st;
        }
        S().setSim({ hlStation: null }); break; }
      case 'container': say('Picking an empty container here, no scan needed'); await pause(1100, tok); break;
      case 'wait': { const secs = secsOf(f.time), dur = Math.min(4000, Math.max(900, secs * 25)), t0 = performance.now();
        while (performance.now() - t0 < dur) { say(`Waiting ${fmt(secs * (1 - (performance.now() - t0) / dur))}`); await pause(100, tok); } break; }
      case 'confirm': say(`Waiting for confirmation: ${f.op}`); await pause(1100, tok); say(`${f.op} confirmed`); await pause(500, tok); break;
      case 'end': say('End node: workflow stops'); await pause(700, tok); break;
    }
    mark(n.id);
  }
  try {
    for (const n of nodes) await visit(n);
    if (tok !== token) return; token++; S().setSim({ status: 'done', step: '', currentId: null, progress: 100 });
  } catch (e) { if (e !== CANCEL) throw e; }
}
