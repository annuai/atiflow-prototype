import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { notify } from '@/ui/toast';
import { fleetMaterialCodes } from '@/features/master-data/model/selectors';
import { fleetStations } from './stations';
import { createNode, syncIds } from './factory';
import { applySteps, parsePrompt } from './parsePrompt';
import { defaultWorkflowName, workflowNameError } from './names';
import { datasetStore, useDataset } from '@/data/dataset';
import { blankWorkflow, isBlankDraft, isKept, seedWorkflows, upgradeToV5, upgradeToV6 } from './seed';
import { approversNow } from '@/features/requests/model/mapping';
import { clampMain, insertNode, listByKey, locate, moveNode, removeNode, updateField, type Problem } from './tree';
import { publishProblem } from './validate';
import type { FieldValue, ListKey, NodeTypeId, WfNode, Workflow, Workflows } from './types';

const KEY = 'atiflow.workflows.v6', KEY_V5 = 'atiflow.workflows.v5', KEY_V4 = 'atiflow.workflows.v4', KEY_V3 = 'atiflow.workflows.v3', KEY_V2 = 'atiflow.workflows.v2';
export interface SimState { status: 'idle' | 'running' | 'done'; step: string; progress: number; currentId: string | null; taken: Record<string, 't' | 'o'>; visited: string[]; hlStation: string | null }
export const SIM_IDLE: SimState = { status: 'idle', step: '', progress: 0, currentId: null, taken: {}, visited: [], hlStation: null };
interface History { undo: string[]; redo: string[] }

export interface WfState {
  /** Fleets that exist (a fleet can have many workflows). */
  workflows: Workflows;
  /** Id of the workflow open in the builder, null before any. */
  current: string | null; selected: string | null; justAdded: string | null; hist: Record<string, History>; sim: SimState;
  nodes(): WfNode[];
  select(id: string | null): void;
  /** Open an existing workflow in the builder. */
  openWorkflow(id: string): void;
  /** Open a new workflow: with a fleet (named <fleet>_workflow_<n>) or without one (the user picks it on the canvas). Reuses an untouched fleet-less draft. Returns its id. */
  startWorkflow(fleet?: string | null): string;
  /** Put the open workflow in a fleet; it gets that fleet's next default name unless the user already named it. */
  assignFleet(fleet: string): void;
  createFleet(name: string): boolean;
  /** Rename a fleet everywhere in the workflow store (list + each workflow's fleet). Workflow names are NOT changed. */
  renameFleet(from: string, to: string): void;
  /** Keep the open workflow as a draft (it would otherwise be discarded when left). */
  saveDraft(): void;
  /** Remove the open workflow if it was never saved or published (called when the user leaves it). */
  discardUnsaved(): void;
  /** Rename the open workflow. Returns false (with a toast) for an empty name. */
  renameWorkflow(name: string): boolean;
  addNode(t: NodeTypeId | 'aiot', key?: ListKey, at?: number): void;
  removeNode(id: string): void; moveNode(id: string, key: ListKey, at: number): void;
  setField(id: string, key: string, value: FieldValue, idx?: number): void;
  addMulti(id: string, key: string, options: string[]): void;
  /** Clicked a station on the map while this node is selected: a single station field takes it, a branch (several stations) adds it, or removes it when it is already there. */
  pickStation(id: string, stationId: string): void;
  undo(): void; redo(): void;
  buildFromPrompt(text: string): boolean; publish(): void;
  setSim(patch: Partial<SimState>): void;
}

const EMPTY: WfNode[] = [];
/** Nodes of the open workflow (stable empty array when none is open). */
export const selectNodes = (s: WfState) => (s.current ? (s.workflows[s.current]?.nodes ?? EMPTY) : EMPTY);
/** Fleet of the open workflow ('' while none is chosen). */
export const selectFleet = (s: WfState) => (s.current ? (s.workflows[s.current]?.fleet ?? '') : '');
export const workflowsOfFleet = (workflows: Workflows, fleet: string) => Object.values(workflows).filter((w) => w.fleet === fleet);

type Saved = { workflows: Workflows; current: string | null };
function load(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    const keep = (ws: Workflows): Workflows => Object.fromEntries(Object.entries(ws).filter(([, w]) => isKept(w)));       // unsaved workflows do not survive a reload
    if (raw?.workflows && typeof raw.workflows === 'object') { const workflows = keep(raw.workflows); Object.values(workflows).forEach((w) => syncIds(w.nodes)); return { workflows, current: null }; }
    const v5 = JSON.parse(localStorage.getItem(KEY_V5) ?? 'null');         // v5: requestors were listed on the Start step
    if (v5?.workflows && typeof v5.workflows === 'object') { const workflows = upgradeToV6(keep(v5.workflows)); Object.values(workflows).forEach((w) => syncIds(w.nodes)); return { workflows, current: null }; }
    const v4 = JSON.parse(localStorage.getItem(KEY_V4) ?? 'null');         // v4: placeholder User IDs and the "Request from Tablet" type
    if (v4?.workflows && typeof v4.workflows === 'object') { const workflows = upgradeToV6(upgradeToV5(keep(v4.workflows))); Object.values(workflows).forEach((w) => syncIds(w.nodes)); return { workflows, current: null }; }
    const v3 = JSON.parse(localStorage.getItem(KEY_V3) ?? 'null');         // v3: no saved flag; built workflows with a fleet count as saved
    if (v3?.workflows && Array.isArray(v3.fleetNames)) {
      const workflows = Object.fromEntries(Object.entries(v3.workflows as Workflows).filter(([, w]) => w.fleet && w.nodes.length > 2).map(([id, w]) => [id, { ...w, saved: true }]));
      Object.values(workflows).forEach((w) => syncIds(w.nodes)); return { workflows, current: null };
    }
    const old = JSON.parse(localStorage.getItem(KEY_V2) ?? 'null');       // v2: one workflow per fleet, keyed by fleet name
    if (old?.fleets) {
      const workflows: Workflows = {}; Object.entries(old.fleets as Record<string, { wf?: string; nodes: WfNode[]; published?: boolean }>).forEach(([fleet, f], i) => {
        syncIds(f.nodes); const id = `w-v2-${i}`; workflows[id] = { id, fleet, nodes: f.nodes, published: f.published, saved: true, name: !f.wf || f.wf === 'Workflow Canvas' ? defaultWorkflowName(fleet) : f.wf };
      });
      return { workflows, current: null };
    }
  } catch { /* fall through */ }
  return { workflows: seedWorkflows(), current: null };
}
/** Workflows saved before stations came from the map used S101-style names in branches and If Logic: they are the map's STA-101 stations. */
function migrateStations(ws: Workflows): Workflows {
  const fix = (v: FieldValue): FieldValue => (Array.isArray(v) ? v.map((x) => String(fix(x))) : typeof v === 'string' ? v.replace(/^S(\d{3})$/, 'STA-$1') : v);
  const walk = (nodes: WfNode[]) => nodes.forEach((n) => { if ('station' in n.f) n.f.station = fix(n.f.station); if (n.br) { walk(n.br.t); walk(n.br.o); } });
  Object.values(ws).forEach((w) => walk(w.nodes)); return ws;
}
const boot = (() => { const b = load(); migrateStations(b.workflows); return b; })();

export const wfStore = createStore<WfState>((set, get) => {
  const problem = (p: Problem | undefined) => { if (p) notify.warning(p.title, p.body || undefined, 'wf-problem'); return !!p; };
  const fleetOf = () => selectFleet(get());
  const patch = (id: string, change: Partial<Workflow>) => set({ workflows: { ...get().workflows, [id]: { ...get().workflows[id], ...change } } });
  /** Apply an edit to the open workflow's nodes and record undo history. No-op edits are ignored. */
  const commit = (next: WfNode[]) => {
    const { workflows, current, hist } = get(); if (!current) return false; const before = JSON.stringify(workflows[current].nodes); if (JSON.stringify(next) === before) return false;
    const h = hist[current] ?? { undo: [], redo: [] };
    set({ workflows: { ...workflows, [current]: { ...workflows[current], nodes: next, published: false } }, hist: { ...hist, [current]: { undo: [...h.undo, before].slice(-100), redo: [] } } }); return true;
  };
  return {
    workflows: boot.workflows, current: boot.current, selected: null, justAdded: null, hist: {}, sim: SIM_IDLE,
    nodes: () => selectNodes(get()),
    select: (selected) => set({ selected }),
    openWorkflow(id) { if (get().workflows[id] && get().current !== id) set({ current: id, selected: null, sim: SIM_IDLE }); },
    startWorkflow(fleet = null) {
      const reuse = fleet === null ? Object.values(get().workflows).find(isBlankDraft) : undefined;
      const w = reuse ?? blankWorkflow(fleet, workflowsOfFleet(get().workflows, fleet ?? '').map((x) => x.name));
      set({ workflows: { ...get().workflows, [w.id]: w }, current: w.id, selected: null, sim: SIM_IDLE }); return w.id;
    },
    assignFleet(fleet) {
      const { current, workflows } = get(); if (!current) return; const w = workflows[current]; if (w.fleet === fleet) return;
      const others = workflowsOfFleet(workflows, fleet).filter((x) => x.id !== current).map((x) => x.name);
      const wasDefault = !w.name || (w.fleet !== null && w.name.startsWith(`${w.fleet}_workflow_`));
      patch(current, { fleet, name: wasDefault ? defaultWorkflowName(fleet, others) : w.name }); set({ sim: SIM_IDLE });
    },
    saveDraft() { const { current } = get(); if (!current || !get().workflows[current].fleet) return; patch(current, { saved: true }); notify.success('Draft saved', 'Find it under the fleet’s Workflows tab.', 'wf-saved'); },
    discardUnsaved() {
      const { current, workflows } = get(); if (!current || !workflows[current] || isKept(workflows[current])) return;
      const { [current]: _gone, ...rest } = workflows; set({ workflows: rest, current: null, selected: null, sim: SIM_IDLE });
    },
    renameWorkflow(name) {
      const e = workflowNameError(name); if (e) { notify.warning(e, undefined, 'wf-name'); return false; }
      const { current, workflows } = get(); if (!current) return false; if (workflows[current].name !== name.trim()) patch(current, { name: name.trim() }); return true;
    },
    renameFleet(from, to) { set({ workflows: Object.fromEntries(Object.entries(get().workflows).map(([id, w]) => [id, w.fleet === from ? { ...w, fleet: to } : w])) }); },
    createFleet(name) {
      let n = name.trim();
      if (!n) { notify.warning('Give the fleet a name first.', 'For example: Warehouse Fleet', 'fleet-name'); return false; }
      if (!/fleet$/i.test(n)) n += ' Fleet';
      if (datasetStore.getState().fleets.some((k) => k.name.toLowerCase() === n.toLowerCase()) ) { notify.warning(`${n} already exists.`, 'Pick a different name.', 'fleet-name'); return false; }
      datasetStore.getState().addFleet(n);
      notify.success(`${n} created`, 'Assign robots, hardware and materials, then build its workflows.', 'fleet-created'); return true;
    },
    addNode(t, key = 'main', at) {
      if (!get().current) return;
      if (t === 'aiot') { problem({ title: 'AIoT has no node card in the Figma file yet', body: 'Only the palette tile is designed, so it can’t be added to the canvas.' }); return; }
      const first = fleetMaterialCodes(fleetOf())[0] ?? '';      // new Material / If Logic nodes start on the fleet's first assigned material
      const firstStation = fleetStations(fleetOf())[0]?.id ?? '';       // new Station / If Logic nodes start on the fleet's first station of the map
      const before = (() => { if (t !== 'confirm') return ''; const list = listByKey(get().nodes(), key) ?? []; const i = key === 'main' ? clampMain(list, at ?? list.length) : Math.min(at ?? list.length, list.length);          // a new Confirm step is approved where the step before it happens
        for (let k = i - 1; k >= 0; k--) if (list[k].t === 'station') { const v = list[k].f.station; return Array.isArray(v) ? v[0] : String(v); } return ''; })();
      const node = createNode(t, t === 'station' ? { station: key !== 'main' ? [firstStation] : firstStation } : t === 'material' ? { code: first } : t === 'confirm' ? { station: before } : undefined);
      if (t === 'logic') { const [a = '', b = a] = fleetStations(fleetOf()).map((s) => s.id); node.f.material = first; node.f.station = a; if (a) { node.br!.t[0].f.station = [a]; node.br!.o[0].f.station = [b]; } }
      const r = insertNode(get().nodes(), node, key, at); if (problem(r.problem)) return;
      commit(r.nodes); set({ selected: node.id, justAdded: node.id });
    },
    removeNode(id) { const r = removeNode(get().nodes(), id); if (problem(r.problem)) return; commit(r.nodes); if (get().selected === id) set({ selected: null }); },
    moveNode(id, key, at) { const r = moveNode(get().nodes(), id, key, at); if (problem(r.problem)) return; commit(r.nodes); },
    setField(id, key, value, idx) { commit(updateField(get().nodes(), id, key, value, idx)); set({ selected: id }); },
    addMulti(id, key, options) {
      const n = locate(get().nodes(), id)?.node; if (!n) return; const cur = n.f[key]; const vals = Array.isArray(cur) ? cur : [cur as string];
      const next = options.find((o) => !vals.includes(o)); if (!next) { notify.warning('Every option is already added.', '', 'wf-problem'); return; }
      commit(updateField(get().nodes(), id, key, [...vals, next]));
    },
    pickStation(id, stationId) {
      const n = locate(get().nodes(), id)?.node; if (!n || (n.t !== 'station' && n.t !== 'logic')) return; const cur = n.f.station;
      const next = Array.isArray(cur) ? (cur.includes(stationId) ? (cur.length > 1 ? cur.filter((x) => x !== stationId) : cur) : [...cur.filter(Boolean), stationId]) : stationId;
      commit(updateField(get().nodes(), id, 'station', next)); set({ selected: id });
    },
    undo() { const { current, hist, workflows } = get(); if (!current) return; const h = hist[current]; const s = h?.undo.at(-1); if (!h || s === undefined) return;
      set({ workflows: { ...workflows, [current]: { ...workflows[current], nodes: JSON.parse(s) } }, hist: { ...hist, [current]: { undo: h.undo.slice(0, -1), redo: [...h.redo, JSON.stringify(workflows[current].nodes)] } }, selected: null }); },
    redo() { const { current, hist, workflows } = get(); if (!current) return; const h = hist[current]; const s = h?.redo.at(-1); if (!h || s === undefined) return;
      set({ workflows: { ...workflows, [current]: { ...workflows[current], nodes: JSON.parse(s) } }, hist: { ...hist, [current]: { redo: h.redo.slice(0, -1), undo: [...h.undo, JSON.stringify(workflows[current].nodes)] } }, selected: null }); },
    buildFromPrompt(text) {
      const steps = parsePrompt(text, fleetMaterialCodes(fleetOf()));
      if (!steps.length) { notify.error('Ati AI couldn’t find any steps', `Try: “material ${fleetMaterialCodes(fleetOf())[0] ?? 'code'}, if quantity greater than 10 go to S103, otherwise S102, confirm, drop at STA-104”`, 'ai'); return false; }
      commit(applySteps(get().nodes(), steps)); set({ justAdded: steps[0].id });
      notify.success(`Built ${steps.length} step${steps.length > 1 ? 's' : ''} from your description`, 'Use the back arrow at the top to undo.', 'ai'); return true;
    },
    publish() {
      const { current } = get(); if (!current) return;
      const p = publishProblem(get().nodes(), approversNow()); if (p) { notify.warning(p.title, p.body, 'publish'); return; }
      patch(current, { published: true, saved: true });
      notify.success(`Workflow published to ${fleetOf()}`, `${get().nodes().length} nodes are live. Use Simulate to watch a test run on the map.`, 'publish');
    },
    setSim: (patch) => set({ sim: { ...get().sim, ...patch } }),
  };
});
export const useWorkflow = <T,>(sel: (s: WfState) => T) => useStore(wfStore, sel);
/** Names of all fleets (re-renders only when the list changes). */
export const useFleetNames = () => useDataset((s) => s.fleets.map((f) => f.name).join('|')).split('|').filter(Boolean);

// persist workflows (not history/sim) shortly after any change
let timer: ReturnType<typeof setTimeout> | undefined;
wfStore.subscribe((s, p) => { if (s.workflows === p.workflows && s.current === p.current) return; clearTimeout(timer); timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify({ workflows: s.workflows, current: s.current })); } catch { /* no storage (tests / private mode) */ } }, 250); });

if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __wf: wfStore });   // dev-only handle for console testing
