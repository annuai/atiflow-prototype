import { beforeEach, describe, expect, it } from 'vitest';
import { sampleWorkflows, seedWorkflows, upgradeToV6 } from '../src/features/workflow-builder/model/seed';
import { createNode, createStart } from '../src/features/workflow-builder/model/factory';
import { publishProblem } from '../src/features/workflow-builder/model/validate';
import { confirmStations, dropOffStations, needsApproval, requestableItems, visibleWorkflows, workflowLegs } from '../src/features/requests/model/catalog';
import { canApprove, canCancel, currentStep, groupRequests, isAllowedNext } from '../src/features/requests/model/rules';
import { approversFrom } from '../src/features/requests/model/mapping';
import { decisions } from '../src/features/requests/model/decisions';
import { normalise, requestsStore } from '../src/features/requests/model/store';
import { requestNotifications } from '../src/features/requests/notifications';
import { seedGroups, seedMaterials } from '../src/features/master-data/model/seed';
import { SEED_USERS } from '../src/features/auth/users';
import { toPublic } from '../src/features/auth/userDirectory';
import type { Workflow } from '../src/features/workflow-builder/model/types';

const fleetIds: Record<string, string> = { 'Line Side Fleet': 'line-side', 'Assembly Fleet': 'assembly' }; const fleetIdOf = (n: string) => fleetIds[n]; const fleetLiveOf = (n: string) => (n === 'Assembly Fleet' ? 'asrs' : 'line-side');
const groups = seedGroups(0), materials = seedMaterials(0, groups); const samples = sampleWorkflows(); const approversAt = approversFrom(SEED_USERS);
const op = (name: string) => { const u = SEED_USERS.find((x) => x.username === name)!; return { username: u.username, name: `${u.firstName} ${u.lastName}`.trim(), fleets: u.fleets ?? [], stations: u.stations ?? [] }; };
const rohan = op('rohan'), sneha = op('sneha'), vikram = op('vikram');
const items = (who: typeof rohan, ws: Workflow[] = samples) => requestableItems(ws, who, fleetIdOf, fleetLiveOf, materials, groups);

describe('which workflows and materials an operator sees', () => {
  it('the fleet must be assigned AND the workflow must deliver to a station the operator is responsible for', () => {
    expect(items(rohan).map((i) => i.code)).toEqual(['DCP-1001', 'DCP-1002', 'DCP-1003', 'DCP-1004']);        // drop-offs STA-107 / 108 / 110 / 105 are Rohan's
    expect(items(sneha).map((i) => i.code)).toEqual(['DCP-1005', 'DCP-1006']); expect(items(vikram)).toEqual([]);          // the store operator approves, he does not request
    expect(items({ ...rohan, fleets: [] })).toEqual([]); expect(items({ ...rohan, stations: [] })).toEqual([]); expect(items({ ...rohan, stations: ['STA-107'] }).map((i) => i.code)).toEqual(['DCP-1001']);
    expect(items({ ...sneha, fleets: ['line-side'] })).toEqual([]);                                                            // her stations are on a fleet that is not hers
  });
  it('only published workflows started from the Tablet are offered', () => {
    const w = structuredClone(samples[0]); w.published = false; expect(visibleWorkflows([w], rohan, fleetIdOf)).toEqual([]);
    const mes = structuredClone(samples[0]); mes.nodes[0].f.request = 'MES'; expect(visibleWorkflows([mes], rohan, fleetIdOf)).toEqual([]);
    const call = structuredClone(samples[0]); call.nodes[0].f.request = 'Call Button'; expect(visibleWorkflows([call], rohan, fleetIdOf)).toEqual([]);
  });
  it('a card has the material name, code and group from Master Data; the quantity is editable only when the workflow lets the tablet choose it', () => {
    const [pin, plate] = items(rohan); expect(pin).toMatchObject({ code: 'DCP-1001', name: 'Drive Chain Pin 8mm', group: 'Fasteners & Fixings', qty: 20, qtyEditable: true });
    expect(plate).toMatchObject({ code: 'DCP-1002', name: 'Drive Chain Plate 12mm', qty: 10, qtyEditable: false });
    expect(requestableItems(samples, rohan, fleetIdOf, fleetLiveOf, materials.filter((m) => m.code !== 'DCP-1001'), groups).some((i) => i.code === 'DCP-1001')).toBe(false);          // gone from Master Data: left out
  });
  it('every Confirm step is an approval, at the station of that step', () => {
    const by = Object.fromEntries([...items(rohan), ...items(sneha)].map((i) => [i.code, i.approvalStations])); expect(by).toEqual({ 'DCP-1001': ['STA-116'], 'DCP-1002': [], 'DCP-1003': ['STA-119'], 'DCP-1004': [], 'DCP-1005': ['STA-116'], 'DCP-1006': [] });
    const two = [createStart(), createNode('station', { action: 'Pick Up', station: 'STA-116' }), createNode('confirm', { station: 'STA-116' }), createNode('confirm', { station: 'STA-119' }), createNode('confirm', { station: '' }), createNode('end')];
    expect(confirmStations(two)).toEqual(['STA-116', 'STA-119']); expect(needsApproval([createNode('wait')])).toBe(false); expect(dropOffStations(samples[0].nodes)).toEqual(['STA-107']);
  });
  it('the trip follows the Station steps of the flow; the load is carried from after the first Pick Up', () => {
    expect(workflowLegs(samples[0].nodes)).toEqual({ legs: ['STA-116', 'STA-107'], loadFrom: 1 });
    expect(workflowLegs([createStart(), createNode('station', { action: 'Drop Off', station: 'STA-5' }), createNode('station', { action: 'Drop Off', station: 'STA-5' })])).toEqual({ legs: ['STA-5'], loadFrom: 0 });
  });
  it('who approves where follows the station mapping of the users (with the Approve permission)', () => {
    expect(approversAt('STA-116')).toEqual(['vikram']); expect(approversAt('STA-119')).toEqual(['vikram']); expect(approversAt('STA-107')).toEqual([]);          // Rohan has the station but only requests
    expect(toPublic(SEED_USERS.find((u) => u.username === 'rohan')!).stations).toEqual(['STA-105', 'STA-107', 'STA-108', 'STA-110']);
  });
});

describe('the sample workflows, the upgrade and the publish gate', () => {
  it('six published Tablet workflows, one per material, and the seeds keep their order and their Confirm stations', () => {
    expect(samples).toHaveLength(6); expect(samples.every((w) => w.published && w.saved)).toBe(true); expect(new Set(samples.map((w) => (w.nodes[1].f.code as string))).size).toBe(6);
    const seeds = seedWorkflows(); expect(Object.keys(seeds).slice(0, 2)).toEqual(['w-line-side-1', 'w-assembly-1']); expect(seeds['w-line-side-1'].nodes.filter((n) => n.t === 'confirm').every((n) => !!n.f.station)).toBe(true);
  });
  it('the old User ID list goes, a Confirm step gets the station before it, and the samples are replaced by the current ones', () => {
    const old = { 'w-x': { id: 'w-x', name: 'x', fleet: 'Line Side Fleet', saved: true, nodes: [createStart({ user: ['rohan'] }), createNode('station', { action: 'Pick Up', station: 'STA-116' }), createNode('confirm', { station: '' }), createNode('end')] }, 'w-sample-1001': { ...samples[0], name: 'stale' } };
    const up = upgradeToV6(old); expect(up['w-x'].nodes[0].f.user).toBeUndefined(); expect(up['w-x'].nodes[2].f.station).toBe('STA-116'); expect(up['w-sample-1001'].name).toBe('Chain Pin to Workstation 1');
  });
  it('a Tablet workflow needs a station on every Confirm step and an operator mapped to each; other request types need neither', () => {
    const wf = (confirm: Record<string, string>, request = 'Tablet') => [createStart({ request }), createNode('material', { code: 'DCP-1001' }), createNode('station', { action: 'Pick Up', station: 'STA-116' }), createNode('confirm', confirm), createNode('station', { action: 'Drop Off', station: 'STA-107' }), createNode('end')];
    expect(publishProblem(wf({ station: '' }), approversAt)?.title).toMatch(/approval station/); expect(publishProblem(wf({ station: 'STA-107' }), approversAt)?.title).toBe('Nobody is mapped to STA-107');
    expect(publishProblem(wf({ station: 'STA-116' }), approversAt)).toBeNull(); expect(publishProblem(wf({ station: '' }, 'MES'), approversAt)).toBeNull();
  });
});

describe('requests: statuses, approvals in turn and cancel', () => {
  beforeEach(() => requestsStore.getState().reset());
  const submit = (who = rohan, list = items(rohan).slice(0, 3), qty = [20, 10, 5]) => requestsStore.getState().submit(who, list.map((item, i) => ({ item, qty: qty[i] })), 1000);
  const rs = () => requestsStore.getState().requests;
  it('a cart becomes one order of independent requests, each with its own trip id: pending with a Confirm step, approved without', () => {
    expect(submit()).toBe('ORD-0001'); expect(rs().map((r) => [r.id, r.groupId, r.status, r.tripId])).toEqual([['ORD-0001-1', 'ORD-0001', 'pending', 'TRP-001'], ['ORD-0001-2', 'ORD-0001', 'approved', 'TRP-002'], ['ORD-0001-3', 'ORD-0001', 'pending', 'TRP-003']]);
    expect(rs()[0]).toMatchObject({ name: 'Drive Chain Pin 8mm', qty: 20, legs: ['STA-116', 'STA-107'], fleetLive: 'line-side', requestedBy: 'rohan', approvals: [{ stationId: 'STA-116' }] }); expect(submit()).toBe('ORD-0002'); expect(rs()[3].tripId).toBe('TRP-004');
  });
  it('only an operator mapped to the Confirm station approves; the requestor does not, unless they are the only one mapped there', () => {
    submit(); const r1 = rs()[0]; expect(canApprove(r1, vikram, approversAt)).toBe(true); expect(canApprove(r1, rohan, approversAt)).toBe(false); expect(canApprove(r1, sneha, approversAt)).toBe(false);
    expect(canApprove(r1, rohan, () => ['rohan'])).toBe(true); expect(canApprove(r1, rohan, () => ['rohan', 'vikram'])).toBe(false);
    expect(requestsStore.getState().approve(r1.id, rohan, approversAt)).toBe(false); expect(requestsStore.getState().approve(r1.id, vikram, approversAt, 2000)).toBe(true); expect(rs()[0]).toMatchObject({ status: 'approved', approvedBy: 'Vikram Nair' });
    expect(requestsStore.getState().reject(rs()[2].id, vikram, approversAt, 'Out of stock', 2000)).toBe(true); expect(rs()[2]).toMatchObject({ status: 'rejected', note: 'Out of stock' }); expect(requestsStore.getState().approve(rs()[2].id, vikram, approversAt)).toBe(false);
  });
  it('several Confirm steps are approved in turn, each by the operators of its station; the request is approved (and the trip may start) only after the last', () => {
    const two = { ...items(rohan)[0], approvalStations: ['STA-116', 'STA-119'] }; const who = (st: string) => (id: string) => (id === st ? ['vikram'] : ['sneha']);
    submit(rohan, [two], [5]); const r = () => rs()[0]; expect(currentStep(r())).toMatchObject({ stationId: 'STA-116' });
    expect(requestsStore.getState().approve(r().id, vikram, who('STA-119'), 2000)).toBe(false);                          // the first step is at STA-116: vikram is not the approver there in this map
    expect(requestsStore.getState().approve(r().id, vikram, approversAt, 2000)).toBe(true); expect(r().status).toBe('pending'); expect(currentStep(r())).toMatchObject({ stationId: 'STA-119' }); expect(r().history.at(-1)?.note).toBe('Approved at STA-116 (1 of 2)');
    expect(requestsStore.getState().approve(r().id, vikram, approversAt, 3000)).toBe(true); expect(r().status).toBe('approved'); expect(r().approvals.every((a) => a.by === 'Vikram Nair')).toBe(true);
  });
  it('only the requester cancels, only one request at a time, and only until a robot is on its way', () => {
    submit(); expect(requestsStore.getState().cancel('ORD-0001-1', vikram)).toBe(false); expect(requestsStore.getState().cancel('ORD-0001-1', rohan, 3000)).toBe(true);
    expect(rs().map((r) => r.status)).toEqual(['cancelled', 'approved', 'pending']); requestsStore.getState().apply({ id: 'ORD-0001-2', status: 'ongoing', tripId: 'TRP-002', robotId: 'AMR-1' }); expect(canCancel(rs()[1], rohan)).toBe(false); expect(requestsStore.getState().cancel('ORD-0001-2', rohan)).toBe(false);
  });
  it('the floor drives approved -> ongoing -> completed; a late report on a cancelled request is ignored; nothing runs before approval; a restart re-queues ongoing trips keeping their id', () => {
    submit(); requestsStore.getState().apply({ id: 'ORD-0001-2', status: 'ongoing', tripId: 'TRP-002', robotId: 'AMR-1' }, 2000); requestsStore.getState().apply({ id: 'ORD-0001-2', status: 'completed', tripId: 'TRP-002' }, 3000);
    expect(rs()[1]).toMatchObject({ status: 'completed', tripId: 'TRP-002', robotId: 'AMR-1' }); expect(rs()[1].history.map((h) => h.status)).toEqual(['approved', 'ongoing', 'completed']);
    requestsStore.getState().cancel('ORD-0001-1', rohan); requestsStore.getState().apply({ id: 'ORD-0001-1', status: 'ongoing' }); expect(rs()[0].status).toBe('cancelled'); requestsStore.getState().apply({ id: 'ORD-0001-3', status: 'ongoing' }); expect(rs()[2].status).toBe('pending');
    submit(); requestsStore.getState().apply({ id: 'ORD-0002-2', status: 'ongoing', tripId: 'TRP-005', robotId: 'AMR-1' }); requestsStore.getState().requeueOngoing(); expect(rs().find((r) => r.id === 'ORD-0002-2')).toMatchObject({ status: 'approved', tripId: 'TRP-005', robotId: undefined });
  });
  it('transitions and grouping', () => {
    expect(isAllowedNext('completed', 'ongoing')).toBe(false); expect(isAllowedNext('pending', 'ongoing')).toBe(false); expect(isAllowedNext('pending', 'approved')).toBe(true);
    submit(); submit(); expect(groupRequests(rs()).map((g) => [g.groupId, g.requests.length])).toEqual([['ORD-0002', 3], ['ORD-0001', 3]]);
  });
  it('notifications: the requester hears every status change; the operators of the current Confirm station hear about requests waiting for them', () => {
    submit(); requestsStore.getState().approve('ORD-0001-1', vikram, approversAt, 2000); requestsStore.getState().apply({ id: 'ORD-0001-2', status: 'ongoing', tripId: 'TRP-002', robotId: 'AMR-1' }, 2500);
    const user = (n: string) => toPublic(SEED_USERS.find((u) => u.username === n)!);
    expect(requestNotifications(rs(), user('rohan'), approversAt).map((n) => n.title)).toEqual(['Drive Chain Pin 8mm ×20 was approved', 'Drive Chain Plate 12mm ×10 is on its way']);
    expect(requestNotifications(rs(), user('vikram'), approversAt).map((n) => n.id)).toEqual(['appr:ORD-0001-3:1']); expect(requestNotifications(rs(), user('sneha'), approversAt)).toEqual([]);
  });
  it('requests saved by an older version are brought up to date: a trip id, and approval steps (a pending one waits at its pick-up station)', () => {
    const legacy = { id: 'ORD-0007-1', status: 'pending', legs: ['STA-116', 'STA-107'], history: [], requestedBy: 'rohan' } as never; const done = { id: 'ORD-0007-2', status: 'completed', legs: ['STA-1'], history: [], tripId: 'TRP-040' } as never;
    const out = normalise([legacy, done]); expect(out[0].tripId).toMatch(/^TRP-\d+$/); expect(out[0].approvals).toEqual([{ stationId: 'STA-116' }]); expect(out[1]).toMatchObject({ tripId: 'TRP-040', approvals: [] });
    expect(canApprove(out[0], vikram, approversAt)).toBe(true);
  });
  it('the approval history lists every approval and rejection at my stations or by me, newest first, with where the request stands now', () => {
    submit(); requestsStore.getState().approve('ORD-0001-1', vikram, approversAt, 2000); requestsStore.getState().reject('ORD-0001-3', vikram, approversAt, 'Out of stock', 3000);
    const mine = decisions(rs(), { stations: vikram.stations, name: vikram.name }); expect(mine.map((d) => [d.requestId, d.outcome, d.stationId, d.by, d.status])).toEqual([['ORD-0001-3', 'rejected', 'STA-119', 'Vikram Nair', 'rejected'], ['ORD-0001-1', 'approved', 'STA-116', 'Vikram Nair', 'approved']]);
    expect(mine[0].note).toBe('Out of stock'); expect(decisions(rs(), { stations: [], name: 'Nobody' })).toEqual([]); expect(decisions(rs(), { stations: ['STA-116'], name: 'Nobody' }).map((d) => d.requestId)).toEqual(['ORD-0001-1']);
    const two = { ...items(rohan)[0], approvalStations: ['STA-116', 'STA-119'] }; submit(rohan, [two], [5]); const id = rs().at(-1)!.id; requestsStore.getState().approve(id, vikram, approversAt, 4000); expect(decisions(rs(), vikram).find((d) => d.requestId === id)?.step).toBe('1 of 2');
  });
});
