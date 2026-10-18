import { createPersistedStore } from '@/data/persistedStore';
import { useStore } from 'zustand';
import { notify } from '@/ui/toast';
import { services } from '@/services';
import { fleetMaterialCodes } from '@/features/master-data';
import { fleetStations } from './stations';
import { createNode } from './factory';
import { applySteps, parsePrompt } from './parsePrompt';
import { defaultWorkflowName, workflowNameError } from './names';
import { datasetStore, useDataset } from '@/data/dataset';
import { loadWorkflows } from './loadSaved';
import { blankWorkflow, isBlankDraft, isKept } from './seed';
import { insertNode, locate, moveNode, removeNode, updateField, type Problem } from './tree';
import { publishProblem } from './validate';
import type { FieldValue, ListKey, NodeTypeId, WfNode, Workflow, Workflows } from './types';
import { copy } from '../copy';

export interface SimState {
  status: 'idle' | 'running' | 'done';
  step: string;
  progress: number;
  currentId: string | null;
  taken: Record<string, 't' | 'o'>;
  visited: string[];
  hlStation: string | null;
}
export const SIM_IDLE: SimState = {
  status: 'idle',
  step: '',
  progress: 0,
  currentId: null,
  taken: {},
  visited: [],
  hlStation: null,
};
interface History {
  undo: string[];
  redo: string[];
}

export interface WfState {
  /** Fleets that exist (a fleet can have many workflows). */
  workflows: Workflows;
  /** Id of the workflow open in the builder, null before any. */
  current: string | null;
  selected: string | null;
  justAdded: string | null;
  hist: Record<string, History>;
  sim: SimState;
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
  /** The fleet was deleted: so are its workflows (the open one closes). */
  removeFleet(name: string): void;
  /** Keep the open workflow as a draft (it would otherwise be discarded when left). */
  saveDraft(): void;
  /** Remove the open workflow if it was never saved or published (called when the user leaves it). */
  discardUnsaved(): void;
  /** Rename the open workflow. Returns false (with a toast) for an empty name. */
  renameWorkflow(name: string): boolean;
  addNode(t: NodeTypeId | 'aiot', key?: ListKey, at?: number): void;
  removeNode(id: string): void;
  moveNode(id: string, key: ListKey, at: number): void;
  setField(id: string, key: string, value: FieldValue, idx?: number): void;
  addMulti(id: string, key: string, options: string[]): void;
  /** Clicked a station on the map while this node is selected: a single station field takes it, a branch (several stations) adds it, or removes it when it is already there. */
  pickStation(id: string, stationId: string): void;
  undo(): void;
  redo(): void;
  buildFromPrompt(text: string): boolean;
  publish(): void;
  setSim(patch: Partial<SimState>): void;
}

const EMPTY: WfNode[] = [];
/** Nodes of the open workflow (stable empty array when none is open). */
export const selectNodes = (s: WfState) => (s.current ? (s.workflows[s.current]?.nodes ?? EMPTY) : EMPTY);
/** Fleet of the open workflow ('' while none is chosen). */
export const selectFleet = (s: WfState) => (s.current ? (s.workflows[s.current]?.fleet ?? '') : '');
export const workflowsOfFleet = (workflows: Workflows, fleet: string) =>
  Object.values(workflows).filter((w) => w.fleet === fleet);

export const wfStore = createPersistedStore<WfState, Workflows>(
  {
    name: 'workflows',
    read: () => loadWorkflows().workflows,
    save: (v) => services().workflows.save(v),
    pick: (s) => s.workflows, // (history, simulation and the open workflow are not saved)
    apply: (workflows) => ({ workflows, current: null, hist: {} }),
    watch: ['workflows'],
    delayMs: 250,
    saveOnStart: true, // saved workflows are upgraded when read: the upgraded form is saved straight away
    devHandle: '__wf',
  },
  (set, get) => {
    const problem = (p: Problem | undefined) => {
      if (p) notify.warning(p.title, p.body || undefined, 'wf-problem');
      return !!p;
    };
    const fleetOf = () => selectFleet(get());
    const patch = (id: string, change: Partial<Workflow>) =>
      set({ workflows: { ...get().workflows, [id]: { ...get().workflows[id], ...change } } });
    /** Apply an edit to the open workflow's nodes and record undo history. No-op edits are ignored. */
    const commit = (next: WfNode[]) => {
      const { workflows, current, hist } = get();
      if (!current) return false;
      const before = JSON.stringify(workflows[current].nodes);
      if (JSON.stringify(next) === before) return false;
      const h = hist[current] ?? { undo: [], redo: [] };
      set({
        workflows: { ...workflows, [current]: { ...workflows[current], nodes: next, published: false } },
        hist: { ...hist, [current]: { undo: [...h.undo, before].slice(-100), redo: [] } },
      });
      return true;
    };
    return {
      selected: null,
      justAdded: null,
      hist: {},
      sim: SIM_IDLE,
      nodes: () => selectNodes(get()),
      select: (selected) => set({ selected }),
      openWorkflow(id) {
        if (get().workflows[id] && get().current !== id) set({ current: id, selected: null, sim: SIM_IDLE });
      },
      startWorkflow(fleet = null) {
        const reuse = fleet === null ? Object.values(get().workflows).find(isBlankDraft) : undefined;
        const w =
          reuse ??
          blankWorkflow(
            fleet,
            workflowsOfFleet(get().workflows, fleet ?? '').map((x) => x.name),
          );
        set({ workflows: { ...get().workflows, [w.id]: w }, current: w.id, selected: null, sim: SIM_IDLE });
        return w.id;
      },
      assignFleet(fleet) {
        const { current, workflows } = get();
        if (!current) return;
        const w = workflows[current];
        if (w.fleet === fleet) return;
        const others = workflowsOfFleet(workflows, fleet)
          .filter((x) => x.id !== current)
          .map((x) => x.name);
        const wasDefault = !w.name || (w.fleet !== null && w.name.startsWith(`${w.fleet}_workflow_`));
        patch(current, { fleet, name: wasDefault ? defaultWorkflowName(fleet, others) : w.name });
        set({ sim: SIM_IDLE });
      },
      saveDraft() {
        const { current } = get();
        if (!current || !get().workflows[current].fleet) return;
        patch(current, { saved: true });
        notify.success(copy.toasts.draftSavedTitle, copy.toasts.draftSavedBody, 'wf-saved');
      },
      discardUnsaved() {
        const { current, workflows } = get();
        if (!current || !workflows[current] || isKept(workflows[current])) return;
        const { [current]: _gone, ...rest } = workflows;
        set({ workflows: rest, current: null, selected: null, sim: SIM_IDLE });
      },
      renameWorkflow(name) {
        const e = workflowNameError(name);
        if (e) {
          notify.warning(e, undefined, 'wf-name');
          return false;
        }
        const { current, workflows } = get();
        if (!current) return false;
        if (workflows[current].name !== name.trim()) patch(current, { name: name.trim() });
        return true;
      },
      renameFleet(from, to) {
        set({
          workflows: Object.fromEntries(
            Object.entries(get().workflows).map(([id, w]) => [id, w.fleet === from ? { ...w, fleet: to } : w]),
          ),
        });
      },
      removeFleet(name) {
        const { workflows, current, hist } = get();
        const gone = Object.keys(workflows).filter((id) => workflows[id].fleet === name);
        if (!gone.length) return;
        set({
          workflows: Object.fromEntries(Object.entries(workflows).filter(([id]) => !gone.includes(id))),
          hist: Object.fromEntries(Object.entries(hist).filter(([id]) => !gone.includes(id))),
          current: current && gone.includes(current) ? null : current,
        });
      },
      createFleet(name) {
        let n = name.trim();
        if (!n) {
          notify.warning(copy.toasts.fleetNameFirstTitle, copy.toasts.fleetNameFirstBody, 'fleet-name');
          return false;
        }
        if (!/fleet$/i.test(n)) n += ' Fleet';
        if (datasetStore.getState().fleets.some((k) => k.name.toLowerCase() === n.toLowerCase())) {
          notify.warning(copy.toasts.fleetExistsTitle(n), copy.toasts.fleetExistsBody, 'fleet-name');
          return false;
        }
        datasetStore.getState().addFleet(n);
        notify.success(copy.toasts.fleetCreatedTitle(n), copy.toasts.fleetCreatedBody, 'fleet-created');
        return true;
      },
      addNode(t, key = 'main', at) {
        if (!get().current) return;
        if (t === 'aiot') {
          problem({ title: copy.problems.aiotTitle, body: copy.problems.aiotBody });
          return;
        }
        const first = fleetMaterialCodes(fleetOf())[0] ?? ''; // new Material / If Logic nodes start on the fleet's first assigned material
        const firstStation = fleetStations(fleetOf())[0]?.id ?? ''; // new Station / If Logic nodes start on the fleet's first station of the map
        const node = createNode(
          t,
          t === 'station'
            ? { station: key !== 'main' ? [firstStation] : firstStation }
            : t === 'material'
              ? { code: first }
              : undefined,
        );
        if (t === 'logic') {
          const [a = '', b = a] = fleetStations(fleetOf()).map((s) => s.id);
          node.f.material = first;
          node.f.station = a;
          if (a) {
            node.br!.t[0].f.station = [a];
            node.br!.o[0].f.station = [b];
          }
        }
        const r = insertNode(get().nodes(), node, key, at);
        if (problem(r.problem)) return;
        commit(r.nodes);
        set({ selected: node.id, justAdded: node.id });
      },
      removeNode(id) {
        const r = removeNode(get().nodes(), id);
        if (problem(r.problem)) return;
        commit(r.nodes);
        if (get().selected === id) set({ selected: null });
      },
      moveNode(id, key, at) {
        const r = moveNode(get().nodes(), id, key, at);
        if (problem(r.problem)) return;
        commit(r.nodes);
      },
      setField(id, key, value, idx) {
        commit(updateField(get().nodes(), id, key, value, idx));
        set({ selected: id });
      },
      addMulti(id, key, options) {
        const n = locate(get().nodes(), id)?.node;
        if (!n) return;
        const cur = n.f[key];
        const vals = Array.isArray(cur) ? cur : [cur as string];
        const next = options.find((o) => !vals.includes(o));
        if (!next) {
          notify.warning(copy.toasts.allOptionsAdded, '', 'wf-problem');
          return;
        }
        commit(updateField(get().nodes(), id, key, [...vals, next]));
      },
      pickStation(id, stationId) {
        const n = locate(get().nodes(), id)?.node;
        if (!n || (n.t !== 'station' && n.t !== 'logic')) return;
        const cur = n.f.station;
        const next = Array.isArray(cur)
          ? cur.includes(stationId)
            ? cur.length > 1
              ? cur.filter((x) => x !== stationId)
              : cur
            : [...cur.filter(Boolean), stationId]
          : stationId;
        commit(updateField(get().nodes(), id, 'station', next));
        set({ selected: id });
      },
      undo() {
        const { current, hist, workflows } = get();
        if (!current) return;
        const h = hist[current];
        const s = h?.undo.at(-1);
        if (!h || s === undefined) return;
        set({
          workflows: { ...workflows, [current]: { ...workflows[current], nodes: JSON.parse(s) } },
          hist: {
            ...hist,
            [current]: { undo: h.undo.slice(0, -1), redo: [...h.redo, JSON.stringify(workflows[current].nodes)] },
          },
          selected: null,
        });
      },
      redo() {
        const { current, hist, workflows } = get();
        if (!current) return;
        const h = hist[current];
        const s = h?.redo.at(-1);
        if (!h || s === undefined) return;
        set({
          workflows: { ...workflows, [current]: { ...workflows[current], nodes: JSON.parse(s) } },
          hist: {
            ...hist,
            [current]: { redo: h.redo.slice(0, -1), undo: [...h.undo, JSON.stringify(workflows[current].nodes)] },
          },
          selected: null,
        });
      },
      buildFromPrompt(text) {
        const steps = parsePrompt(text, fleetMaterialCodes(fleetOf()));
        if (!steps.length) {
          notify.error(
            copy.toasts.aiNoneTitle,
            copy.toasts.aiNoneBody(fleetMaterialCodes(fleetOf())[0] ?? 'code'),
            'ai',
          );
          return false;
        }
        commit(applySteps(get().nodes(), steps));
        set({ justAdded: steps[0].id });
        notify.success(copy.toasts.aiBuiltTitle(steps.length), copy.toasts.aiBuiltBody, 'ai');
        return true;
      },
      publish() {
        const { current } = get();
        if (!current) return;
        const p = publishProblem(get().nodes());
        if (p) {
          notify.warning(p.title, p.body, 'publish');
          return;
        }
        patch(current, { published: true, saved: true });
        notify.success(
          copy.toasts.publishedTitle(fleetOf()),
          copy.toasts.publishedBody(get().nodes().length),
          'publish',
        );
      },
      setSim: (patch) => set({ sim: { ...get().sim, ...patch } }),
    };
  },
);
export const useWorkflow = <T>(sel: (s: WfState) => T) => useStore(wfStore, sel);
/** Names of all fleets (re-renders only when the list changes). */
export const useFleetNames = () =>
  useDataset((s) => s.fleets.map((f) => f.name).join('|'))
    .split('|')
    .filter(Boolean);

// the list as loaded (upgraded from an older version, old robot names replaced, sample routes added) is saved straight away, not only after the next edit
