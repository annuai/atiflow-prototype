import { createPersistedStore } from '@/data/persistedStore';
import { fleetRef } from '@/data/fleetRef';
import { useStore } from 'zustand';
import type { OrderUpdate } from '@/core/types';
import { tripIds, tripNumber } from '@/data/tripIds';
import { services } from '@/services';
import type { RequestsDocument } from './schema';
import { can } from '@/features/access';
import { toPublic, userDirectory } from '@/features/auth';
import { reserveCells, settleCells } from './cells';
import { canApprove, canCancel, currentStep, isAllowedNext, type Person } from './rules';
import type { CartLine, RequestableItem, RequestStatus, TripRequest } from './types';

/**
 * All requests (history included), saved in this browser (`StorageBackend`: a server later = another backend). The store only keeps and changes requests following the rules in
 * `rules.ts`; handing approved ones to the fleet and taking updates back is `bridge.ts`.
 */
type Saved = { requests: TripRequest[]; seq: number };

interface Requester {
  username: string;
  name: string;
}
export interface RequestsState extends Saved {
  /** Make the requests of a cart. Each becomes its own request (pending when its workflow has a Confirm step, otherwise approved). Returns the order id. */
  submit(who: Requester, lines: { item: RequestableItem; qty: number }[], now?: number): string;
  /** Approve the step the request waits for (the next Confirm station, in turn); the request is approved when the last step is. */
  approve(id: string, who: Person & { name: string }, now?: number): boolean;
  reject(id: string, who: Person & { name: string }, reason?: string, now?: number): boolean;
  /** Cancel one request (never the others of its order). */
  cancel(id: string, who: Person & { name: string }, now?: number): boolean;
  /** The fleet reported something about the request. */
  apply(u: OrderUpdate, now?: number): void;
  /** The floor restarted (the simulator lives in the page): trips that were on their way start over, so they wait for a robot again. */
  requeueOngoing(now?: number): void;
  reset(): void;
}
const pad = (n: number, w = 4) => String(n).padStart(w, '0');
const push = (r: TripRequest, status: RequestStatus, at: number, by?: string, note?: string): TripRequest => ({
  ...r,
  status,
  history: [...r.history, { status, at, by, note }],
});

/**
 * Requests saved by an older version are brought up to date: they get the trip id they never had, and the approval steps they never had (a request that was still pending waits for approval at its
 * pick-up station, so it can still be decided). Without this a saved request would break the pages that read `approvals`.
 */
export function normalise(list: TripRequest[]): TripRequest[] {
  // an approval step saved with a station (before approvals named users) can be decided by anyone who may approve
  const legacy = () =>
    userDirectory
      .getState()
      .users.filter((u) => can(toPublic(u), 'operator.approve'))
      .map((u) => u.username);
  return list.map((r) => {
    const withTrip = r.tripId ? r : { ...r, tripId: tripIds.next() };
    const approvals = Array.isArray(withTrip.approvals)
      ? withTrip.approvals.map((a) => (Array.isArray((a as Partial<typeof a>).users) ? a : { ...a, users: legacy() }))
      : withTrip.status === 'pending' && withTrip.legs?.length
        ? [{ users: legacy() }]
        : [];
    return { ...withTrip, fleet: withTrip.fleet ? fleetRef(withTrip.fleet) : withTrip.fleet, approvals }; // (a request saved with a fleet NAME points at its id)
  });
}
export const requestsStore = createPersistedStore<RequestsState, RequestsDocument>(
  {
    name: 'requests',
    read: () => services().requests.snapshot(),
    save: (v) => services().requests.save(v),
    pick: (s) => ({ requests: s.requests, seq: s.seq }) as RequestsDocument,
    apply: ({ requests, seq }) => {
      const list = normalise(requests as TripRequest[]);
      tripIds.ensureAtLeast(Math.max(0, ...list.map((r) => tripNumber(r.tripId)))); // saved requests keep their ids: new ones count on from them
      return { requests: list, seq };
    },
    watch: ['requests', 'seq'],
    // another tab (another operator on the same browser) changed the requests: take them over
    listen: (cb) => services().requests.subscribe(cb),
    devHandle: '__requests',
  },
  (set, get) => ({
    submit(who, lines, now = Date.now()) {
      const seq = get().seq + 1;
      const groupId = `ORD-${pad(seq)}`;
      const made: TripRequest[] = lines.map(({ item, qty }, i) => {
        const base: TripRequest = {
          id: `${groupId}-${i + 1}`,
          groupId,
          workflowId: item.workflowId,
          workflowName: item.workflowName,
          fleet: item.fleet,
          fleetLive: item.fleetLive,
          code: item.code,
          name: item.name,
          group: item.group,
          qty: item.kind === 'route' ? 0 : qty,
          ...(item.kind ? { kind: item.kind } : {}),
          ...(item.robotType ? { robotType: item.robotType } : {}),
          legs: item.legs,
          legActions: item.legActions,
          loadFrom: item.loadFrom,
          approvals: item.approvalUsers.map((users) => ({ users })),
          needsApproval: item.needsApproval,
          status: 'pending',
          history: [],
          requestedBy: who.username,
          requestedByName: who.name,
          createdAt: now,
          tripId: tripIds.next(),
        };
        // staging areas: take the material / reserve the cell now; when that cannot be done the request fails at once, saying why
        const held = reserveCells(base);
        if (held.failed) return { ...push(base, 'failed', now, 'Staging area', held.failed), note: held.failed };
        const made = held.plan ? { ...base, cells: held.plan } : base;
        return item.needsApproval
          ? push(made, 'pending', now, who.name)
          : push(made, 'approved', now, 'No approval needed');
      });
      set({ seq, requests: [...get().requests, ...made] });
      return groupId;
    },
    approve(id, who, now = Date.now()) {
      const r = get().requests.find((x) => x.id === id);
      if (!r || !canApprove(r, who)) return false;
      const step = currentStep(r)!;
      const approvals = r.approvals.map((a) => (a === step ? { ...a, by: who.name, at: now } : a));
      const left = approvals.filter((a) => !a.by).length;
      const total = approvals.length;
      const next = left
        ? {
            ...r,
            approvals,
            history: [
              ...r.history,
              { status: 'pending' as const, at: now, by: who.name, note: `Approved (${total - left} of ${total})` },
            ],
          }
        : { ...push(r, 'approved', now, who.name, `${total} of ${total} approvals`), approvals, approvedBy: who.name };
      set({ requests: get().requests.map((x) => (x.id === id ? next : x)) });
      return true;
    },
    reject(id, who, reason, now = Date.now()) {
      const r = get().requests.find((x) => x.id === id);
      if (!r || !canApprove(r, who)) return false;
      set({
        requests: get().requests.map((x) =>
          x.id === id
            ? { ...push(x, 'rejected', now, who.name, reason), note: reason, cells: settleCells(x, 'released') }
            : x,
        ),
      });
      return true;
    },
    cancel(id, who, now = Date.now()) {
      const r = get().requests.find((x) => x.id === id);
      if (!r || !canCancel(r, who)) return false;
      set({
        requests: get().requests.map((x) =>
          x.id === id ? { ...push(x, 'cancelled', now, who.name), cells: settleCells(x, 'released') } : x,
        ),
      });
      return true;
    },
    apply(u, now = Date.now()) {
      const r = get().requests.find((x) => x.id === u.id);
      if (!r) return;
      const to: RequestStatus = u.status;
      if (r.status === to && !(to === 'ongoing' && u.tripId && u.tripId !== r.tripId)) return;
      if (!isAllowedNext(r.status, to) && !(r.status === 'ongoing' && to === 'ongoing')) return; // e.g. a cancelled request ignores a late report
      set({
        requests: get().requests.map((x) =>
          x.id === u.id
            ? {
                ...push(x, to, now, 'Fleet', u.reason),
                tripId: u.tripId ?? x.tripId,
                robotId: u.robotId ?? x.robotId,
                note: u.reason ?? x.note,
                cells:
                  to === 'completed'
                    ? settleCells(x, 'committed')
                    : to === 'failed'
                      ? settleCells(x, 'released')
                      : x.cells,
              }
            : x,
        ),
      });
    },
    requeueOngoing(now = Date.now()) {
      if (!get().requests.some((r) => r.status === 'ongoing')) return;
      set({
        requests: get().requests.map((r) =>
          r.status === 'ongoing'
            ? {
                ...push(r, 'approved', now, 'Fleet', 'The fleet restarted: waiting for a robot again'),
                robotId: undefined,
              }
            : r,
        ),
      });
    },
    reset() {
      tripIds.reset();
      set({ ...(services().requests.resetToSeed?.() ?? { requests: [], seq: 0 }), requests: [] });
    },
  }),
);
export const useRequests = <T>(sel: (s: RequestsState) => T) => useStore(requestsStore, sel);

/** A cart helper (pure): add or change a line, drop a line, clear. The cart itself lives only in the page while a person chooses; it is never saved. */
export const setLine = (cart: CartLine[], key: string, qty: number): CartLine[] =>
  cart.some((l) => l.key === key) ? cart.map((l) => (l.key === key ? { ...l, qty } : l)) : [...cart, { key, qty }];
export const dropLine = (cart: CartLine[], key: string): CartLine[] => cart.filter((l) => l.key !== key);
