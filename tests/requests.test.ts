import { beforeEach, describe, expect, it } from 'vitest';
import { seedWorkflows, upgradeToV7 } from '../src/features/workflow-builder/model/seed';
import { sampleWorkflows } from '../src/fixtures/workflows';
import { createNode, createStart } from '../src/features/workflow-builder/model/factory';
import { publishProblem } from '../src/features/workflow-builder/model/validate';
import {
  confirmApprovers,
  needsApproval,
  requestableItems,
  requesters,
  visibleWorkflows,
  workflowLegs,
} from '../src/features/requests/model/catalog';
import { canApprove, canCancel, currentStep, groupRequests, isAllowedNext } from '../src/features/requests/model/rules';
import { eligibleUsers, prefillUsers } from '../src/features/workflow-builder/model/users';
import { decisions } from '../src/features/requests/model/decisions';
import { normalise, requestsStore } from '../src/features/requests/model/store';
import { requestNotifications } from '../src/features/requests/notifications';
import { seedGroups, seedMaterials } from '../src/fixtures/masterData';
import { SEED_USERS } from '../src/fixtures/users';
import { toPublic } from '../src/features/auth/userDirectory';
import type { Workflow } from '../src/features/workflow-builder/model/types';

const fleetIds: Record<string, string> = { 'Line Side Fleet': 'line-side', 'Assembly Fleet': 'assembly' };
const fleetIdOf = (n: string) => fleetIds[n];
const fleetLiveOf = (n: string) => (n === 'Assembly Fleet' ? 'asrs' : 'line-side');
const groups = seedGroups(0),
  materials = seedMaterials(0, groups);
const samples = sampleWorkflows();
const op = (name: string) => {
  const u = SEED_USERS.find((x) => x.username === name)!;
  return { username: u.username, name: `${u.firstName} ${u.lastName}`.trim(), fleets: u.fleets ?? [] };
};
const rohan = op('rohan'),
  sneha = op('sneha'),
  vikram = op('vikram');
const items = (who: typeof rohan, ws: Workflow[] = samples) =>
  requestableItems(ws, who, fleetIdOf, fleetLiveOf, materials, groups);

describe('which workflows and materials an operator sees', () => {
  it('the fleet must be assigned AND the operator must be listed in the Start step of the workflow', () => {
    expect(items(rohan).map((i) => i.code)).toEqual(['DCP-1001', 'DCP-1002', 'DCP-1003', 'DCP-1004']); // the Line Side samples list Rohan
    expect(items(sneha).map((i) => i.code)).toEqual(['DCP-1005', 'DCP-1006']);
    expect(items(vikram)).toEqual([]); // the store operator approves, he is not listed as a requester
    expect(items({ ...rohan, fleets: [] })).toEqual([]);
    expect(items({ ...rohan, username: 'someone-else' })).toEqual([]);
    expect(items({ ...sneha, fleets: ['line-side'] })).toEqual([]); // a fleet that is not hers
    const few = structuredClone(samples[0]);
    few.nodes[0].f.users = ['rohan', 'sneha'];
    expect(visibleWorkflows([few], sneha, fleetIdOf)).toEqual([]); // listed, but the fleet is not hers
    expect(requesters(samples[0].nodes)).toEqual(['rohan']);
  });
  it('only published workflows started from the Tablet are offered', () => {
    const w = structuredClone(samples[0]);
    w.published = false;
    expect(visibleWorkflows([w], rohan, fleetIdOf)).toEqual([]);
    const mes = structuredClone(samples[0]);
    mes.nodes[0].f.request = 'MES';
    expect(visibleWorkflows([mes], rohan, fleetIdOf)).toEqual([]);
    const call = structuredClone(samples[0]);
    call.nodes[0].f.request = 'Call Button';
    expect(visibleWorkflows([call], rohan, fleetIdOf)).toEqual([]);
  });
  it('a card has the material name, code and group from Master Data; the quantity is editable only when the workflow lets the tablet choose it', () => {
    const [pin, plate] = items(rohan);
    expect(pin).toMatchObject({
      code: 'DCP-1001',
      name: 'Drive Chain Pin 8mm',
      group: 'Fasteners & Fixings',
      qty: 20,
      qtyEditable: true,
    });
    expect(plate).toMatchObject({ code: 'DCP-1002', name: 'Drive Chain Plate 12mm', qty: 10, qtyEditable: false });
    expect(
      requestableItems(
        samples,
        rohan,
        fleetIdOf,
        fleetLiveOf,
        materials.filter((m) => m.code !== 'DCP-1001'),
        groups,
      ).some((i) => i.code === 'DCP-1001'),
    ).toBe(false); // gone from Master Data: left out
  });
  it('every Tablet Confirm step is one approval, given by any of its users; other operations are not approvals', () => {
    const by = Object.fromEntries([...items(rohan), ...items(sneha)].map((i) => [i.code, i.approvalUsers]));
    expect(by).toEqual({
      'DCP-1001': [['vikram']],
      'DCP-1002': [],
      'DCP-1003': [['vikram']],
      'DCP-1004': [],
      'DCP-1005': [['vikram']],
      'DCP-1006': [],
    });
    const two = [
      createStart(),
      createNode('confirm', { op: 'Tablet', users: ['a', 'b'] }),
      createNode('confirm', { op: 'Tablet', users: ['c'] }),
      createNode('confirm', { op: 'Dispatch Button', users: ['z'] }),
      createNode('confirm', { op: 'Barcode Scan' }),
      createNode('end'),
    ];
    expect(confirmApprovers(two)).toEqual([['a', 'b'], ['c']]);
    expect(needsApproval([createNode('wait')])).toBe(false);
    expect(needsApproval(two)).toBe(true);
    expect(needsApproval([createNode('confirm', { op: 'Dispatch Button' })])).toBe(false);
  });
  it('the trip follows the Station steps of the flow; the load is carried from after the first Pick Up', () => {
    expect(workflowLegs(samples[0].nodes)).toEqual({
      legs: ['STA-116', 'STA-107'],
      actions: ['Pick Up', 'Drop Off'],
      loadFrom: 1,
    });
    expect(
      workflowLegs([
        createStart(),
        createNode('station', { action: 'Drop Off', station: 'STA-5' }),
        createNode('station', { action: 'Drop Off', station: 'STA-5' }),
      ]),
    ).toEqual({ legs: ['STA-5'], actions: ['Drop Off'], loadFrom: 0 });
  });
  it("the Start and Confirm steps offer the users who hold Request / Approve on the workflow's fleet", () => {
    const all = ['line-side', 'assembly'];
    expect(eligibleUsers(SEED_USERS, 'line-side', 'operator.book-trip', all).map((u) => u.id)).toEqual([
      'meera',
      'rohan',
      'vikram',
    ]);
    expect(eligibleUsers(SEED_USERS, 'assembly', 'operator.book-trip', all).map((u) => u.id)).toEqual([
      'meera',
      'sneha',
      'vikram',
    ]); // Meera (a configurator with every module ticked) is not limited to fleets
    expect(eligibleUsers(SEED_USERS, 'line-side', 'operator.approve', all).map((u) => u.id)).toEqual([
      'meera',
      'vikram',
    ]);
    expect(eligibleUsers(SEED_USERS, undefined, 'operator.book-trip', all)).toEqual([]);
  });
});

describe('the sample workflows, the upgrade and the publish gate', () => {
  it('six published Tablet workflows, one per material, and the seeds keep their order', () => {
    expect(samples).toHaveLength(6);
    expect(samples.every((w) => w.published && w.saved)).toBe(true);
    expect(new Set(samples.map((w) => w.nodes[1].f.code as string)).size).toBe(6);
    const seeds = seedWorkflows();
    expect(Object.keys(seeds).slice(0, 2)).toEqual(['w-line-side-1', 'w-assembly-1']);
    expect(
      seeds['w-line-side-1'].nodes
        .filter((n) => n.t === 'confirm')
        .every((n) => n.f.station === undefined && Array.isArray(n.f.users)),
    ).toBe(true);
  });
  it('upgrade: a Confirm step loses its station, Weight Sensor becomes Dispatch Button, the Start step gets a user list, and the samples are replaced by the current ones', () => {
    const old = {
      'w-x': {
        id: 'w-x',
        name: 'x',
        fleet: 'Line Side Fleet',
        saved: true,
        nodes: [
          createStart({ user: ['rohan'] }),
          createNode('station', { action: 'Pick Up', station: 'STA-116' }),
          createNode('confirm', { station: 'STA-116', op: 'Weight Sensor' }),
          createNode('end'),
        ],
      },
      'w-sample-1001': { ...samples[0], name: 'stale' },
    };
    const up = upgradeToV7(old);
    expect(up['w-x'].nodes[0].f.users).toEqual([]);
    expect(up['w-x'].nodes[2].f).toEqual({ op: 'Dispatch Button', users: [] });
    expect(up['w-sample-1001'].name).toBe('Chain Pin to Workstation 1');
  });
  it('a Tablet workflow needs request users and, on every Tablet Confirm step, an approval user who is not the only requester; other request types and operations need none', () => {
    const wf = (confirm: Record<string, string | string[]>, users: string[] = ['rohan'], request = 'Tablet') => [
      createStart({ request, users }),
      createNode('material', { code: 'DCP-1001' }),
      createNode('station', { action: 'Pick Up', station: 'STA-116' }),
      createNode('confirm', confirm),
      createNode('station', { action: 'Drop Off', station: 'STA-107' }),
      createNode('end'),
    ];
    expect(publishProblem(wf({ op: 'Tablet', users: ['vikram'] }, []))?.title).toBe('Add the users who can request');
    expect(publishProblem(wf({ op: 'Tablet', users: [] }))?.title).toMatch(/needs an approval user/);
    expect(publishProblem(wf({ op: 'Tablet', users: ['rohan'] }))?.title).toMatch(/rohan is the only approver/);
    expect(publishProblem(wf({ op: 'Tablet', users: ['rohan', 'vikram'] }))).toBeNull();
    expect(publishProblem(wf({ op: 'Tablet', users: ['vikram'] }))).toBeNull();
    expect(publishProblem(wf({ op: 'Dispatch Button' }))).toBeNull();
    expect(publishProblem(wf({ op: 'Tablet' }, [], 'MES'))).toBeNull();
  });
});

describe('workflows saved before users were named', () => {
  it('a Tablet workflow with empty lists gets the people who may request / approve on its fleet; lists that already have users and other request types are left alone', () => {
    const w = (request: string, users: string[] = []) => ({
      id: 'w',
      name: 'x',
      fleet: 'Line Side Fleet',
      saved: true,
      nodes: [
        createStart({ request, users }),
        createNode('confirm', { op: 'Tablet', users: [] }),
        createNode('confirm', { op: 'Dispatch Button', users: [] }),
        createNode('end'),
      ],
    });
    const fleets = [
      { id: 'line-side', name: 'Line Side Fleet', color: '#000' },
      { id: 'assembly', name: 'Assembly Fleet', color: '#000' },
    ];
    const out = prefillUsers({ w: w('Tablet') }, SEED_USERS, fleets as never).w;
    expect(out.nodes[0].f.users).toEqual(['meera', 'rohan', 'vikram']);
    expect(out.nodes[1].f.users).toEqual(['meera', 'vikram']);
    expect(out.nodes[2].f.users).toEqual([]);
    expect(prefillUsers({ w: w('Tablet', ['rohan']) }, SEED_USERS, fleets as never).w.nodes[0].f.users).toEqual([
      'rohan',
    ]);
    expect(prefillUsers({ w: w('MES') }, SEED_USERS, fleets as never).w.nodes[0].f.users).toEqual([]);
  });
});

describe('requests: statuses, approvals in turn and cancel', () => {
  beforeEach(() => requestsStore.getState().reset());
  const submit = (who = rohan, list = items(rohan).slice(0, 3), qty = [20, 10, 5]) =>
    requestsStore.getState().submit(
      who,
      list.map((item, i) => ({ item, qty: qty[i] })),
      1000,
    );
  const rs = () => requestsStore.getState().requests;
  it('a cart becomes one order of independent requests, each with its own trip id: pending with a Confirm step, approved without', () => {
    expect(submit()).toBe('ORD-0001');
    expect(rs().map((r) => [r.id, r.groupId, r.status, r.tripId])).toEqual([
      ['ORD-0001-1', 'ORD-0001', 'pending', 'TRP-001'],
      ['ORD-0001-2', 'ORD-0001', 'approved', 'TRP-002'],
      ['ORD-0001-3', 'ORD-0001', 'pending', 'TRP-003'],
    ]);
    expect(rs()[0]).toMatchObject({
      name: 'Drive Chain Pin 8mm',
      qty: 20,
      legs: ['STA-116', 'STA-107'],
      fleetLive: 'line-side',
      requestedBy: 'rohan',
      approvals: [{ users: ['vikram'] }],
    });
    expect(submit()).toBe('ORD-0002');
    expect(rs()[3].tripId).toBe('TRP-004');
  });
  it("only one of the step's approval users approves, never the requester, even when listed", () => {
    submit();
    const r1 = rs()[0];
    expect(canApprove(r1, vikram)).toBe(true);
    expect(canApprove(r1, rohan)).toBe(false);
    expect(canApprove(r1, sneha)).toBe(false);
    const listed = { ...r1, approvals: [{ users: ['rohan', 'vikram'] }] };
    expect(canApprove(listed, rohan)).toBe(false);
    expect(canApprove(listed, vikram)).toBe(true);
    expect(requestsStore.getState().approve(r1.id, rohan)).toBe(false);
    expect(requestsStore.getState().approve(r1.id, vikram, 2000)).toBe(true);
    expect(rs()[0]).toMatchObject({ status: 'approved', approvedBy: 'Vikram Nair' });
    expect(requestsStore.getState().reject(rs()[2].id, vikram, 'Out of stock', 2000)).toBe(true);
    expect(rs()[2]).toMatchObject({ status: 'rejected', note: 'Out of stock' });
    expect(requestsStore.getState().approve(rs()[2].id, vikram)).toBe(false);
  });
  it('several Confirm steps are approved in turn, each by one of its users; the request is approved (and the trip may start) only after the last', () => {
    const two = { ...items(rohan)[0], approvalUsers: [['vikram'], ['sneha', 'vikram']] };
    submit(rohan, [two], [5]);
    const r = () => rs()[0];
    expect(currentStep(r())).toMatchObject({ users: ['vikram'] });
    expect(requestsStore.getState().approve(r().id, sneha, 2000)).toBe(false); // the first step is vikram's: sneha only comes in at the second
    expect(requestsStore.getState().approve(r().id, vikram, 2000)).toBe(true);
    expect(r().status).toBe('pending');
    expect(currentStep(r())).toMatchObject({ users: ['sneha', 'vikram'] });
    expect(r().history.at(-1)?.note).toBe('Approved (1 of 2)');
    expect(requestsStore.getState().approve(r().id, sneha, 3000)).toBe(true);
    expect(r().status).toBe('approved');
    expect(r().approvals.map((a) => a.by)).toEqual(['Vikram Nair', 'Sneha Rao']);
  });
  it('only the requester cancels, only one request at a time, and only until a robot is on its way', () => {
    submit();
    expect(requestsStore.getState().cancel('ORD-0001-1', vikram)).toBe(false);
    expect(requestsStore.getState().cancel('ORD-0001-1', rohan, 3000)).toBe(true);
    expect(rs().map((r) => r.status)).toEqual(['cancelled', 'approved', 'pending']);
    requestsStore.getState().apply({ id: 'ORD-0001-2', status: 'ongoing', tripId: 'TRP-002', robotId: 'AMR-1' });
    expect(canCancel(rs()[1], rohan)).toBe(false);
    expect(requestsStore.getState().cancel('ORD-0001-2', rohan)).toBe(false);
  });
  it('the floor drives approved -> ongoing -> completed; a late report on a cancelled request is ignored; nothing runs before approval; a restart re-queues ongoing trips keeping their id', () => {
    submit();
    requestsStore.getState().apply({ id: 'ORD-0001-2', status: 'ongoing', tripId: 'TRP-002', robotId: 'AMR-1' }, 2000);
    requestsStore.getState().apply({ id: 'ORD-0001-2', status: 'completed', tripId: 'TRP-002' }, 3000);
    expect(rs()[1]).toMatchObject({ status: 'completed', tripId: 'TRP-002', robotId: 'AMR-1' });
    expect(rs()[1].history.map((h) => h.status)).toEqual(['approved', 'ongoing', 'completed']);
    requestsStore.getState().cancel('ORD-0001-1', rohan);
    requestsStore.getState().apply({ id: 'ORD-0001-1', status: 'ongoing' });
    expect(rs()[0].status).toBe('cancelled');
    requestsStore.getState().apply({ id: 'ORD-0001-3', status: 'ongoing' });
    expect(rs()[2].status).toBe('pending');
    submit();
    requestsStore.getState().apply({ id: 'ORD-0002-2', status: 'ongoing', tripId: 'TRP-005', robotId: 'AMR-1' });
    requestsStore.getState().requeueOngoing();
    expect(rs().find((r) => r.id === 'ORD-0002-2')).toMatchObject({
      status: 'approved',
      tripId: 'TRP-005',
      robotId: undefined,
    });
  });
  it('transitions and grouping', () => {
    expect(isAllowedNext('completed', 'ongoing')).toBe(false);
    expect(isAllowedNext('pending', 'ongoing')).toBe(false);
    expect(isAllowedNext('pending', 'approved')).toBe(true);
    submit();
    submit();
    expect(groupRequests(rs()).map((g) => [g.groupId, g.requests.length])).toEqual([
      ['ORD-0002', 3],
      ['ORD-0001', 3],
    ]);
  });
  it('notifications: the requester hears every status change; the approval users of the current Confirm step hear about requests waiting for them', () => {
    submit();
    requestsStore.getState().approve('ORD-0001-1', vikram, 2000);
    requestsStore.getState().apply({ id: 'ORD-0001-2', status: 'ongoing', tripId: 'TRP-002', robotId: 'AMR-1' }, 2500);
    const user = (n: string) => toPublic(SEED_USERS.find((u) => u.username === n)!);
    expect(requestNotifications(rs(), user('rohan')).map((n) => n.title)).toEqual([
      'Drive Chain Pin 8mm ×20 was approved',
      'Drive Chain Plate 12mm ×10 is on its way',
    ]);
    expect(requestNotifications(rs(), user('vikram')).map((n) => n.id)).toEqual(['appr:ORD-0001-3:1']);
    expect(requestNotifications(rs(), user('sneha'))).toEqual([]);
  });
  it('requests saved by an older version are brought up to date: a trip id, and approval steps (a pending one can be decided by anyone who may approve)', () => {
    const legacy = {
      id: 'ORD-0007-1',
      status: 'pending',
      legs: ['STA-116', 'STA-107'],
      history: [],
      requestedBy: 'rohan',
    } as never;
    const done = { id: 'ORD-0007-2', status: 'completed', legs: ['STA-1'], history: [], tripId: 'TRP-040' } as never;
    const out = normalise([legacy, done]);
    expect(out[0].tripId).toMatch(/^TRP-\d+$/);
    expect(out[0].approvals).toHaveLength(1);
    expect(out[0].approvals[0].users).toContain('vikram');
    expect(out[0].approvals[0].users).not.toContain('rohan');
    expect(out[1]).toMatchObject({ tripId: 'TRP-040', approvals: [] });
    expect(canApprove(out[0], vikram)).toBe(true);
  });
  it('the approval history lists every approval and rejection on steps I am an approval user of, or made by me, newest first, with where the request stands now', () => {
    submit();
    requestsStore.getState().approve('ORD-0001-1', vikram, 2000);
    requestsStore.getState().reject('ORD-0001-3', vikram, 'Out of stock', 3000);
    const mine = decisions(rs(), vikram);
    expect(mine.map((d) => [d.requestId, d.outcome, d.by, d.status])).toEqual([
      ['ORD-0001-3', 'rejected', 'Vikram Nair', 'rejected'],
      ['ORD-0001-1', 'approved', 'Vikram Nair', 'approved'],
    ]);
    expect(mine[0].note).toBe('Out of stock');
    expect(decisions(rs(), { username: 'nobody', name: 'Nobody' })).toEqual([]);
    expect(decisions(rs(), { username: 'vikram', name: 'Nobody' })).toHaveLength(2);
    const two = { ...items(rohan)[0], approvalUsers: [['vikram'], ['vikram']] };
    submit(rohan, [two], [5]);
    const id = rs().at(-1)!.id;
    requestsStore.getState().approve(id, vikram, 4000);
    expect(decisions(rs(), vikram).find((d) => d.requestId === id)?.step).toBe('1 of 2');
  });
});
