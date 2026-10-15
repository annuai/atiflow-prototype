import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FleetSim } from '../src/adapters/sim';
import type { NavGraph, OrderUpdate, SiteLayout, TransportOrder } from '../src/core/types';
import { bookingError, canCancelBooking } from '../src/features/bookings/model/rules';
import { bookingsStore } from '../src/features/bookings/model/store';
import type { BookingInput } from '../src/features/bookings/model/types';
import { historyEntries } from '../src/features/operator-history/entries';
import type { TripRequest } from '../src/features/requests/model/types';
import { SEED_USERS } from '../src/features/auth/users';
import { can } from '../src/features/access';
import { toPublic } from '../src/features/auth/userDirectory';

const site = JSON.parse(readFileSync('public/sites/ecc/site.json', 'utf8')) as SiteLayout, nav = JSON.parse(readFileSync('public/sites/ecc/nav.json', 'utf8')) as NavGraph;
const input = (over: Partial<BookingInput> = {}): BookingInput => ({ fleet: 'Line Side Fleet', fleetLive: 'line-side', robotType: 'sherpa-xt-lite', robotLabel: 'Sherpa XT Lite', from: 'STA-116', to: 'STA-107', fromName: 'STA-116 · VStore - ASRS 1', toName: 'STA-107 · Assembly Workstation 1', ...over });
const rohan = { username: 'rohan', name: 'Rohan Mehta' };

describe('booking a custom trip', () => {
  beforeEach(() => bookingsStore.getState().reset());
  const trips = () => bookingsStore.getState().trips;
  it('needs a robot, two different stations', () => {
    expect(bookingError(input())).toBe(''); expect(bookingError(input({ robotType: '' }))).toMatch(/robot/); expect(bookingError(input({ from: '' }))).toMatch(/start/); expect(bookingError(input({ to: '' }))).toMatch(/end/); expect(bookingError(input({ to: 'STA-116' }))).toMatch(/different/);
  });
  it('a booking gets a trip id at once and waits for a robot (no approval); an invalid one books nothing', () => {
    expect(bookingsStore.getState().book(rohan, input({ to: 'STA-116' }), 1000)).toBeNull(); expect(trips()).toEqual([]);
    const t = bookingsStore.getState().book(rohan, input(), 1000)!; expect(t).toMatchObject({ id: 'BKG-0001', status: 'approved', bookedBy: 'rohan', robotType: 'sherpa-xt-lite', from: 'STA-116', to: 'STA-107' }); expect(t.tripId).toMatch(/^TRP-\d+$/);
    expect(bookingsStore.getState().book(rohan, input(), 2000)!.id).toBe('BKG-0002'); expect(trips().map((x) => x.history[0].status)).toEqual(['approved', 'approved']);
  });
  it('only the person who booked cancels, and only until a robot is on its way; the floor drives it ongoing and completed', () => {
    const t = bookingsStore.getState().book(rohan, input(), 1000)!; expect(canCancelBooking(t, { username: 'sneha' })).toBe(false); expect(bookingsStore.getState().cancel(t.id, { username: 'sneha' })).toBe(false);
    bookingsStore.getState().apply({ id: t.id, status: 'ongoing', tripId: t.tripId, robotId: 'AMR-001' }, 2000); expect(trips()[0]).toMatchObject({ status: 'ongoing', robotId: 'AMR-001' }); expect(bookingsStore.getState().cancel(t.id, rohan)).toBe(false);
    bookingsStore.getState().apply({ id: t.id, status: 'completed', tripId: t.tripId }, 3000); expect(trips()[0].history.map((h) => h.status)).toEqual(['approved', 'ongoing', 'completed']);
    const u = bookingsStore.getState().book(rohan, input(), 4000)!; expect(bookingsStore.getState().cancel(u.id, rohan, 5000)).toBe(true); bookingsStore.getState().apply({ id: u.id, status: 'ongoing' }); expect(trips()[1].status).toBe('cancelled');          // a late report is ignored
  });
  it('a restart puts trips that were on their way back in the queue', () => {
    const t = bookingsStore.getState().book(rohan, input(), 1000)!; bookingsStore.getState().apply({ id: t.id, status: 'ongoing', robotId: 'AMR-001' }, 2000); bookingsStore.getState().requeueOngoing(3000); expect(trips()[0]).toMatchObject({ status: 'approved', robotId: undefined });
  });
});

describe('an order for a robot of a given type', () => {
  const order = (id: string, over: Partial<TransportOrder> = {}): TransportOrder => ({ id, fleetId: 'line-side', legs: ['STA-116', 'STA-107'], loadFrom: 1, payload: { kind: 'Custom trip', qty: 1 }, ...over });
  it('fails at once when the fleet has no robot of that type; otherwise only a robot of that type takes it', () => {
    const sim = new FleetSim(nav, site.siteId, 14, 7); const model = sim.bots.find((b) => b.fleetId === 'line-side')!.model;
    expect(sim.submitOrder(order('B-X', { robotModel: 'sherpa-flex-fork' }))).toBe(false); expect(sim.drainOrderUpdates()).toEqual([{ id: 'B-X', status: 'failed', reason: 'No robot of this type is on the floor' }]);
    expect(sim.submitOrder(order('B-1', { robotModel: model }))).toBe(true); const updates: OrderUpdate[] = []; for (let t = 0; t < 180 && !updates.some((u) => u.status === 'ongoing'); t += 0.1) { sim.step(0.1); updates.push(...sim.drainOrderUpdates()); sim.drainEvents(); }
    const on = updates.find((u) => u.status === 'ongoing')!; expect(sim.bots.find((b) => b.id === on.robotId)!.model).toBe(model);
  });
});

describe('the consolidated history', () => {
  const req = (over: Partial<TripRequest>): TripRequest => ({ id: 'ORD-0001-1', groupId: 'ORD-0001', workflowId: 'w', workflowName: 'Chain Pin to Workstation 1', fleet: 'Line Side Fleet', fleetLive: 'line-side', code: 'DCP-1001', name: 'Drive Chain Pin 8mm', group: 'g', qty: 20, legs: [], loadFrom: 0, approvals: [{ users: ['vikram'], by: 'Vikram Nair', at: 3000 }], needsApproval: true, status: 'approved', history: [{ status: 'pending', at: 1000 }, { status: 'approved', at: 3000 }], requestedBy: 'rohan', requestedByName: 'Rohan Mehta', createdAt: 1000, tripId: 'TRP-001', ...over });
  it('lists my requests, the approvals I made and the trips I booked, newest first, and nothing of other people', () => {
    bookingsStore.getState().reset(); const mine = bookingsStore.getState().book(rohan, input(), 5000)!; bookingsStore.getState().book({ username: 'sneha', name: 'Sneha Rao' }, input(), 6000);
    const reqs = [req({}), req({ id: 'ORD-0002-1', requestedBy: 'sneha', requestedByName: 'Sneha Rao', tripId: 'TRP-002', approvals: [{ users: ['vikram'] }], status: 'pending', history: [{ status: 'pending', at: 4000 }] })];
    const r = historyEntries(reqs, bookingsStore.getState().trips, { username: 'rohan', name: 'Rohan Mehta' }); expect(r.map((e) => [e.kind, e.at])).toEqual([['trip', 5000], ['request', 3000]]); expect(r[0]).toMatchObject({ bookingId: mine.id, title: 'STA-116 · VStore - ASRS 1 → STA-107 · Assembly Workstation 1' });
    const v = historyEntries(reqs, bookingsStore.getState().trips, { username: 'vikram', name: 'Vikram Nair' }); expect(v.map((e) => [e.kind, e.outcome])).toEqual([['approval', 'approved']]);            // he approved one; he booked nothing and requested nothing
    expect(historyEntries([], [], { username: 'nobody', name: 'Nobody' })).toEqual([]);
  });
});

describe('access', () => {
  it('Book trip and History are in the operator preset (so every operator has them) and not for supervisors', () => {
    const op = (n: string) => toPublic(SEED_USERS.find((u) => u.username === n)!); expect(can(op('rohan'), 'operator.book-trip')).toBe(true); expect(can(op('sneha'), 'operator.history')).toBe(true); expect(can(op('arjun'), 'operator.book-trip')).toBe(false);
  });
});
