import { datasetStore } from '../src/data/dataset';
import { describe, it, expect } from 'vitest';
import { blankWorkflow, isBlankDraft, seedWorkflows } from '../src/features/workflow-builder/model/seed';
import { createNode } from '../src/features/workflow-builder/model/factory';
import { insertNode, removeNode, moveNode, updateField, locate, countNodes, placementProblem } from '../src/features/workflow-builder/model/tree';
import { publishProblem } from '../src/features/workflow-builder/model/validate';
import { parsePrompt, applySteps } from '../src/features/workflow-builder/model/parsePrompt';
import { NODE_TYPES, PALETTE } from '../src/features/workflow-builder/model/registry';

const seedOf = (fleet: string) => Object.values(seedWorkflows()).find((w) => w.fleet === fleet)!.nodes;
const fresh = () => blankWorkflow('Test Fleet').nodes;

describe('workflow tree rules', () => {
  it('seed fleets match the reference: 11 + 8 main nodes, Line Side counts 13 with branches', () => {
    const f = Object.values(seedWorkflows()); const by = (n: string) => f.find((w) => w.fleet === n)!; expect(by('Line Side Fleet').nodes.length).toBe(11); expect(by('Assembly Fleet').nodes.length).toBe(8); expect(countNodes(by('Line Side Fleet').nodes)).toBe(13);
  });
  it('inserts between Start and End, never before Start or after End', () => {
    let n = fresh(); n = insertNode(n, createNode('wait'), 'main', 0).nodes; expect(n.map((x) => x.t)).toEqual(['start', 'wait', 'end']);
    n = insertNode(n, createNode('confirm'), 'main', 99).nodes; expect(n.map((x) => x.t)).toEqual(['start', 'wait', 'confirm', 'end']);
  });
  it('rejects a second End, End in a branch, nested If Logic, and AIoT', () => {
    const n = [...fresh()]; const logic = createNode('logic'); const withLogic = insertNode(n, logic, 'main').nodes;
    expect(insertNode(withLogic, createNode('end'), 'main').problem?.title).toMatch(/already ends/);
    expect(placementProblem(withLogic, 'end', `${logic.id}:t`)?.title).toMatch(/End nodes go/);
    expect(placementProblem(withLogic, 'logic', `${logic.id}:t`)?.title).toMatch(/nested/);
    expect(placementProblem(withLogic, 'aiot', 'main')?.title).toMatch(/AIoT/);
  });
  it('Start and End cannot be removed or moved', () => {
    const n = fresh(); expect(removeNode(n, n[0].id).problem).toBeTruthy(); expect(removeNode(n, n[1].id).problem).toBeTruthy(); expect(moveNode(n, n[0].id, 'main', 1).nodes).toEqual(n);
  });
  it('removes and moves ordinary nodes, including into a branch', () => {
    let n = fresh(); const a = createNode('wait'), b = createNode('confirm'), l = createNode('logic');
    n = insertNode(n, a, 'main').nodes; n = insertNode(n, b, 'main').nodes; n = insertNode(n, l, 'main').nodes;
    n = moveNode(n, b.id, 'main', 1).nodes; expect(n.slice(1, 4).map((x) => x.t)).toEqual(['confirm', 'wait', 'logic']);
    n = moveNode(n, a.id, `${l.id}:t`, 0).nodes; expect(locate(n, a.id)?.key).toBe(`${l.id}:t`);
    n = removeNode(n, b.id).nodes; expect(locate(n, b.id)).toBeNull();
  });
  it('updateField sets scalar and indexed multi values immutably', () => {
    const n = fresh(); const m = createNode('station'); const n2 = insertNode(n, m, 'main').nodes;
    const n3 = updateField(n2, m.id, 'action', 'Drop Off'); expect(locate(n3, m.id)!.node.f.action).toBe('Drop Off'); expect(locate(n2, m.id)!.node.f.action).toBe('Pick Up');
    const n4 = updateField(n3, n3[0].id, 'user', 'USER-002', 0); expect((n4[0].f.user as string[])[0]).toBe('USER-002');
  });
  it('registry: every node type is complete and every palette tile (except AIoT) has a spec', () => {
    for (const [k, t] of Object.entries(NODE_TYPES)) { expect(t.label, k).toBeTruthy(); expect(t.w, k).toBeGreaterThan(100); }
    for (const p of PALETTE) if (p.type !== 'aiot') expect(NODE_TYPES[p.type]).toBeTruthy();
  });
});

describe('publish validation', () => {
  it('needs at least one step', () => { expect(publishProblem(fresh())?.title).toMatch(/at least one step/); });
  it('rejects an empty If Logic branch, accepts a valid flow', () => {
    const l = createNode('logic'); l.br!.o = []; expect(publishProblem(insertNode(fresh(), l, 'main').nodes)?.title).toMatch(/branch is empty/);
    expect(publishProblem(seedOf('Line Side Fleet'))).toBeNull();
  });
});

describe('Ati AI prompt parser', () => {
  it('builds the documented example flow', () => {
    const steps = parsePrompt('material 1003, if quantity greater than 10 go to S103, otherwise S102, confirm, drop at STA-104', ['DCP-1001', 'DCP-1003']);
    expect(steps.map((s) => s.t)).toEqual(['material', 'logic', 'confirm', 'station']);
    expect(steps[0].f.code).toBe('DCP-1003'); expect(steps[1].f.cond).toBe('Greater than'); expect(steps[1].f.qty).toBe('10');
    expect(steps[1].br!.t[0].f.station).toEqual(['S103']); expect(steps[1].br!.o[0].f.station).toEqual(['S102']);
    expect(steps[3].f).toMatchObject({ action: 'Drop Off', station: 'STA-104' });
  });
  it('parses wait times, scans, containers and ignores gibberish', () => {
    const s = parsePrompt('wait 2 minutes, scan the barcode, take an empty container'); expect(s.map((x) => x.t)).toEqual(['wait', 'confirm', 'container']);
    expect(s[0].f.time).toBe('00:02:00'); expect(s[1].f.op).toBe('Barcode Scan'); expect(parsePrompt('hello there')).toEqual([]);
  });
  it('applySteps keeps Start/End and replaces the middle', () => {
    const base = seedOf('Assembly Fleet'); const out = applySteps(base, parsePrompt('pick up at STA-101'));
    expect(out[0].id).toBe(base[0].id); expect(out.at(-1)!.t).toBe('end'); expect(out.length).toBe(3);
  });
});

describe('fleets and workflows in the store', () => {
  it('fleet names are unique ignoring case and get the Fleet suffix', async () => {
    const { wfStore } = await import('../src/features/workflow-builder/model/store');
    expect(wfStore.getState().createFleet('Warehouse')).toBe(true); expect(datasetStore.getState().fleets.map((f) => f.name)).toContain('Warehouse Fleet');
    expect(wfStore.getState().createFleet('warehouse fleet')).toBe(false); expect(wfStore.getState().createFleet('   ')).toBe(false);
  });
  it('a new workflow has no fleet; picking one names it <fleet>_workflow_<n> with the next free number', async () => {
    const { wfStore, selectFleet } = await import('../src/features/workflow-builder/model/store');
    const s = wfStore.getState(); const id = s.startWorkflow(); expect(wfStore.getState().workflows[id]).toMatchObject({ fleet: null, name: '' }); expect(selectFleet(wfStore.getState())).toBe('');
    wfStore.getState().assignFleet('Line Side Fleet'); expect(wfStore.getState().workflows[id].name).toBe('Line Side Fleet_workflow_2');   // _1 exists in the seed
    wfStore.getState().assignFleet('Assembly Fleet'); expect(wfStore.getState().workflows[id].name).toBe('Assembly Fleet_workflow_2');
    expect(wfStore.getState().renameWorkflow('  ')).toBe(false); expect(wfStore.getState().renameWorkflow('My flow')).toBe(true); wfStore.getState().assignFleet('Line Side Fleet'); expect(wfStore.getState().workflows[id].name).toBe('My flow');   // a user's name is kept
  });
  it('starting again reuses an untouched fleet-less draft but never a built one', async () => {
    const { wfStore } = await import('../src/features/workflow-builder/model/store');
    const a = wfStore.getState().startWorkflow(); const b = wfStore.getState().startWorkflow(); expect(b).toBe(a);
    const named = wfStore.getState().startWorkflow('Line Side Fleet'); expect(named).not.toBe(a); expect(isBlankDraft(wfStore.getState().workflows[named])).toBe(false);
    wfStore.getState().openWorkflow(a); wfStore.getState().assignFleet('Line Side Fleet'); expect(wfStore.getState().startWorkflow()).not.toBe(a);
  });
  it('leaving a workflow that is neither saved nor published discards it; Save Draft or Publish keeps it', async () => {
    const { wfStore } = await import('../src/features/workflow-builder/model/store');
    const a = wfStore.getState().startWorkflow('Assembly Fleet'); wfStore.getState().discardUnsaved(); expect(wfStore.getState().workflows[a]).toBeUndefined(); expect(wfStore.getState().current).toBeNull();
    const b = wfStore.getState().startWorkflow('Assembly Fleet'); wfStore.getState().saveDraft(); wfStore.getState().discardUnsaved(); expect(wfStore.getState().workflows[b]).toMatchObject({ saved: true });
    wfStore.getState().openWorkflow(b); wfStore.getState().addNode('wait'); wfStore.getState().publish(); expect(wfStore.getState().workflows[b]).toMatchObject({ published: true, saved: true });
    const c = wfStore.getState().startWorkflow(); wfStore.getState().saveDraft(); wfStore.getState().discardUnsaved(); expect(wfStore.getState().workflows[c]).toBeUndefined();   // no fleet -> cannot be saved
    const seed = Object.values(wfStore.getState().workflows).find((w) => w.id === 'w-line-side-1')!; wfStore.getState().openWorkflow(seed.id); wfStore.getState().discardUnsaved(); expect(wfStore.getState().workflows[seed.id]).toBeDefined();   // seeds are saved
  });
  it('nothing can be edited before a workflow is open', async () => {
    const { wfStore } = await import('../src/features/workflow-builder/model/store');
    wfStore.setState({ current: null }); wfStore.getState().addNode('wait'); expect(wfStore.getState().nodes()).toEqual([]);
  });
});

import { defaultWorkflowName, workflowNameError } from '../src/features/workflow-builder/model/names';
describe('workflow names', () => {
  it('default is <fleet>_workflow_<n> with the next free number', () => {
    expect(defaultWorkflowName('Line Side Fleet')).toBe('Line Side Fleet_workflow_1');
    expect(defaultWorkflowName('Line Side Fleet', ['Line Side Fleet_workflow_1', 'line side fleet_workflow_2'])).toBe('Line Side Fleet_workflow_3');
    expect(defaultWorkflowName('A', ['Custom name'])).toBe('A_workflow_1');
  });
  it('an empty name is refused', () => { expect(workflowNameError('  ')).toBeTruthy(); expect(workflowNameError('x')).toBe(''); });
});
