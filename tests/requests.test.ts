import { beforeEach, describe, expect, it } from 'vitest';
import { upgradeToV5, sampleWorkflows, seedWorkflows } from '../src/features/workflow-builder/model/seed';
import { createNode, createStart } from '../src/features/workflow-builder/model/factory';
import { needsApproval, requestableItems, visibleWorkflows, workflowLegs } from '../src/features/requests/model/catalog';
import { canApprove, canCancel, groupRequests, isAllowedNext } from '../src/features/requests/model/rules';
import { requestsStore } from '../src/features/requests/model/store';
import { requestNotifications } from '../src/features/requests/notifications';
import { seedGroups, seedMaterials } from '../src/features/master-data/model/seed';
import { requestUsers } from '../src/features/requests/model/people';
import { SEED_USERS } from '../src/features/auth/users';
import { toPublic } from '../src/features/auth/userDirectory';
import type { Workflow } from '../src/features/workflow-builder/model/types';

const fleetIds: Record<string, string> = { 'Line Side Fleet': 'line-side', 'Assembly Fleet': 'assembly' }; const fleetIdOf = (n: string) => fleetIds[n]; const fleetLiveOf = (n: string) => (n === 'Assembly Fleet' ? 'asrs' : 'line-side');
const groups = seedGroups(0), materials = seedMaterials(0, groups); const samples = sampleWorkflows();
const rohan = { username: 'rohan', fleets: ['line-side'] }, sneha = { username: 'sneha', fleets: ['line-side', 'assembly'] };
const items = (who: typeof rohan, ws: Workflow[] = samples) => requestableItems(ws, who, fleetIdOf, fleetLiveOf, materials, groups);

describe('which workflows and materials an operator sees', () => {
  it('the fleet must be assigned to the operator AND the operator must be listed in the Start step', () => {
    expect(items(rohan).map((i) => i.code)).toEqual(['DCP-1001', 'DCP-1002', 'DCP-1003', 'DCP-1004']);        // Line Side only
    expect(items(sneha)).toHaveLength(6); expect(items({ username: 'nobody', fleets: ['line-side'] })).toEqual([]);          // not listed
    expect(items({ username: 'sneha', fleets: ['assembly'] }).map((i) => i.code)).toEqual(['DCP-1005', 'DCP-1006']);          // listed, but only Assembly is hers
    expect(items({ username: 'rohan', fleets: [] })).toEqual([]);                                                              // no fleet, nothing
  });
  it('only published workflows started from the Tablet are offered', () => {
    const w = structuredClone(samples[0]); w.published = false; expect(visibleWorkflows([w], rohan, fleetIdOf)).toEqual([]);
    const mes = structuredClone(samples[0]); mes.nodes[0].f.request = 'MES'; expect(visibleWorkflows([mes], rohan, fleetIdOf)).toEqual([]);
    const call = structuredClone(samples[0]); call.nodes[0].f.request = 'Call Button'; expect(visibleWorkflows([call], rohan, fleetIdOf)).toEqual([]);
  });
  it('a card has the material name, code and group from Master Data; the quantity is editable only when the workflow lets the tablet choose it', () => {
    const [pin, plate] = items(rohan); expect(pin).toMatchObject({ code: 'DCP-1001', name: 'Drive Chain Pin 8mm', group: 'Fasteners & Fixings', qty: 20, qtyEditable: true });
    expect(plate).toMatchObject({ code: 'DCP-1002', name: 'Drive Chain Plate 12mm', qty: 10, qtyEditable: false });
  });
  it('a material that is not in Master Data any more is left out', () => { expect(requestableItems(samples, sneha, fleetIdOf, fleetLiveOf, materials.filter((m) => m.code !== 'DCP-1001'), groups).some((i) => i.code === 'DCP-1001')).toBe(false); });
  it('a request waits for approval when the workflow has a Confirm step', () => {
    const by = Object.fromEntries(items(sneha).map((i) => [i.code, i.needsApproval])); expect(by).toMatchObject({ 'DCP-1001': true, 'DCP-1002': false, 'DCP-1003': true, 'DCP-1004': false, 'DCP-1005': true, 'DCP-1006': false });
    expect(needsApproval([createNode('wait')])).toBe(false);
  });
  it('the trip follows the Station steps of the flow; the load is carried from after the first Pick Up', () => {
    expect(workflowLegs(samples[0].nodes)).toEqual({ legs: ['STA-116', 'STA-107'], loadFrom: 1 });
    expect(workflowLegs([createStart(), createNode('station', { action: 'Drop Off', station: 'STA-5' }), createNode('station', { action: 'Drop Off', station: 'STA-5' })])).toEqual({ legs: ['STA-5'], loadFrom: 0 });          // no pick-up: carried from the start; the same station twice is one stop
  });
  it('the Start step lists real users: operators of the workflow\'s fleet', () => {
    const all = SEED_USERS.map((u) => ({ ...u })); expect(requestUsers(all, 'assembly', ['line-side', 'assembly']).map((u) => u.username)).toEqual(['meera', 'sneha']);          // Meera: a configurator with every permission; Rohan only works on Line Side
    expect(requestUsers(all, 'line-side', ['line-side', 'assembly']).map((u) => u.username)).toEqual(['meera', 'rohan', 'sneha']);
    expect(toPublic(SEED_USERS.find((u) => u.username === 'rohan')!).fleets).toEqual(['line-side']);
  });
});

describe('the sample workflows and the upgrade of saved ones', () => {
  it('six published Tablet workflows, one per material of Master Data, and the seeds keep their order', () => {
    expect(samples).toHaveLength(6); expect(samples.every((w) => w.published && w.saved)).toBe(true); expect(new Set(samples.map((w) => (w.nodes[1].f.code as string))).size).toBe(6);
    expect(Object.keys(seedWorkflows()).slice(0, 2)).toEqual(['w-line-side-1', 'w-assembly-1']);
  });
  it('"Request from Tablet" becomes "Tablet", the placeholder USER-00x IDs go, and the samples are added once', () => {
    const old = { 'w-x': { id: 'w-x', name: 'x', fleet: 'Line Side Fleet', saved: true, nodes: [createStart({ request: 'Request from Tablet', user: ['USER-001', 'rohan'] }), createNode('end')] } };
    const up = upgradeToV5(old); expect(up['w-x'].nodes[0].f.request).toBe('Tablet'); expect(up['w-x'].nodes[0].f.user).toEqual(['rohan']); expect(Object.keys(up)).toHaveLength(7); expect(Object.keys(upgradeToV5(up))).toHaveLength(7);
  });
});

describe('requests: statuses, approval and cancel', () => {
  beforeEach(() => requestsStore.getState().reset());
  const me = { username: 'rohan', name: 'Rohan Mehta', fleets: ['line-side'] }, other = { username: 'sneha', name: 'Sneha Rao', fleets: ['line-side', 'assembly'] };
  const submit = () => requestsStore.getState().submit(me, items(rohan).slice(0, 3).map((item, i) => ({ item, qty: [20, 10, 5][i] })), 1000);
  it('a cart becomes one order of independent requests: pending with a Confirm step, approved without', () => {
    const id = submit(); expect(id).toBe('ORD-0001'); const rs = requestsStore.getState().requests; expect(rs.map((r) => [r.id, r.groupId, r.status])).toEqual([['ORD-0001-1', 'ORD-0001', 'pending'], ['ORD-0001-2', 'ORD-0001', 'approved'], ['ORD-0001-3', 'ORD-0001', 'pending']]);
    expect(rs[0]).toMatchObject({ name: 'Drive Chain Pin 8mm', qty: 20, legs: ['STA-116', 'STA-107'], fleetLive: 'line-side', requestedBy: 'rohan' }); expect(submit()).toBe('ORD-0002');
  });
  it('another operator of the fleet approves or rejects; the requester never can; someone from another fleet cannot', () => {
    submit(); const [r1, , r3] = requestsStore.getState().requests; expect(canApprove(r1, me, fleetIdOf)).toBe(false); expect(canApprove(r1, other, fleetIdOf)).toBe(true); expect(canApprove(r1, { username: 'x', fleets: ['assembly'] }, fleetIdOf)).toBe(false);
    expect(requestsStore.getState().approve(r1.id, me, fleetIdOf)).toBe(false); expect(requestsStore.getState().approve(r1.id, other, fleetIdOf, 2000)).toBe(true); expect(requestsStore.getState().reject(r3.id, other, fleetIdOf, 'Out of stock', 2000)).toBe(true);
    const rs = requestsStore.getState().requests; expect(rs[0]).toMatchObject({ status: 'approved', approvedBy: 'Sneha Rao' }); expect(rs[2]).toMatchObject({ status: 'rejected', note: 'Out of stock' }); expect(requestsStore.getState().approve(r3.id, other, fleetIdOf)).toBe(false);          // already decided
  });
  it('only the requester cancels, only one request at a time, and only until a robot is on its way', () => {
    submit(); const rs = () => requestsStore.getState().requests; expect(requestsStore.getState().cancel('ORD-0001-1', other)).toBe(false); expect(requestsStore.getState().cancel('ORD-0001-1', me, 3000)).toBe(true);
    expect(rs().map((r) => r.status)).toEqual(['cancelled', 'approved', 'pending']);          // the others of the order are untouched
    requestsStore.getState().apply({ id: 'ORD-0001-2', status: 'ongoing', tripId: 'TRP-9', robotId: 'AMR-1' }); expect(canCancel(rs()[1], me)).toBe(false); expect(requestsStore.getState().cancel('ORD-0001-2', me)).toBe(false);
  });
  it('the floor drives approved -> ongoing -> completed (trip and robot recorded); a late report on a cancelled request is ignored', () => {
    submit(); requestsStore.getState().apply({ id: 'ORD-0001-2', status: 'ongoing', tripId: 'TRP-9', robotId: 'AMR-1' }, 2000); requestsStore.getState().apply({ id: 'ORD-0001-2', status: 'completed', tripId: 'TRP-9' }, 3000);
    expect(requestsStore.getState().requests[1]).toMatchObject({ status: 'completed', tripId: 'TRP-9', robotId: 'AMR-1' }); expect(requestsStore.getState().requests[1].history.map((h) => h.status)).toEqual(['approved', 'ongoing', 'completed']);
    requestsStore.getState().cancel('ORD-0001-1', me); requestsStore.getState().apply({ id: 'ORD-0001-1', status: 'ongoing', tripId: 'TRP-10' }); expect(requestsStore.getState().requests[0].status).toBe('cancelled');
    requestsStore.getState().apply({ id: 'ORD-0001-3', status: 'ongoing' }); expect(requestsStore.getState().requests[2].status).toBe('pending');          // nothing runs before approval
  });
  it('a restarted floor puts ongoing trips back in the queue', () => {
    submit(); requestsStore.getState().apply({ id: 'ORD-0001-2', status: 'ongoing', tripId: 'TRP-9', robotId: 'AMR-1' }); requestsStore.getState().requeueOngoing(); expect(requestsStore.getState().requests[1]).toMatchObject({ status: 'approved', tripId: undefined });
  });
  it('transitions and grouping', () => {
    expect(isAllowedNext('completed', 'ongoing')).toBe(false); expect(isAllowedNext('pending', 'ongoing')).toBe(false); expect(isAllowedNext('pending', 'approved')).toBe(true);
    submit(); submit(); expect(groupRequests(requestsStore.getState().requests).map((g) => [g.groupId, g.requests.length])).toEqual([['ORD-0002', 3], ['ORD-0001', 3]]);
  });
  it('notifications: the requester hears every status change; approvers hear about requests waiting for them', () => {
    submit(); requestsStore.getState().approve('ORD-0001-1', other, fleetIdOf, 2000); requestsStore.getState().apply({ id: 'ORD-0001-2', status: 'ongoing', tripId: 'TRP-9', robotId: 'AMR-1' }, 2500);
    const asRohan = requestNotifications(requestsStore.getState().requests, toPublic(SEED_USERS.find((u) => u.username === 'rohan')!)); expect(asRohan.map((n) => n.title)).toEqual(['Drive Chain Pin 8mm ×20 was approved', 'Drive Chain Plate 12mm ×10 is on its way']);
    const asSneha = requestNotifications(requestsStore.getState().requests, toPublic(SEED_USERS.find((u) => u.username === 'sneha')!)); expect(asSneha.map((n) => n.id)).toEqual(['appr:ORD-0001-3']);
  });
});
