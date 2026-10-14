import { useEffect } from 'react';
import { feed } from '@/features/live-floor/liveFeed';
import { requestsStore } from './store';
import type { TripRequest } from './types';

/**
 * Connects the requests to the fleet: approved requests become transport orders for the floor, the floor's reports come back as statuses.
 * Running while any operator page is on screen (one shared run). If the floor restarts, orders that were not finished are handed over again.
 */
const orderOf = (r: TripRequest) => ({ id: r.id, tripId: r.tripId, fleetId: r.fleetLive, legs: r.legs, loadFrom: r.loadFrom, payload: { kind: r.name, qty: r.qty } });
const handedOver = new Set<string>();

function handOverAll() {
  for (const r of requestsStore.getState().requests) if (r.status === 'approved' || r.status === 'ongoing') { handedOver.add(r.id); if (!feed.orders.submit(orderOf(r))) handedOver.delete(r.id); }
}
function handOverNew() {
  for (const r of requestsStore.getState().requests) if (r.status === 'approved' && !handedOver.has(r.id) && feed.orders.running) { handedOver.add(r.id); if (!feed.orders.submit(orderOf(r))) handedOver.delete(r.id); }
}
/** A cancelled request is taken back from the floor while no robot is on its way with it. */
export function takeBack(id: string): boolean { handedOver.delete(id); return feed.orders.cancel(id); }

let users = 0, off: (() => void)[] = [];
function start() {
  const release = feed.acquire(); void feed.ready();
  const offUpdate = feed.orders.onUpdate((u) => requestsStore.getState().apply(u));
  const offStart = feed.orders.onStart(() => { handedOver.clear(); requestsStore.getState().requeueOngoing(); handOverAll(); });
  const offStore = requestsStore.subscribe(handOverNew);
  handOverNew(); off = [offUpdate, offStart, offStore, release];
}
/** Keep requests flowing to the floor while the component is mounted. */
export function useRequestsRunning() {
  useEffect(() => { if (users++ === 0) start(); return () => { if (--users === 0) { off.forEach((f) => f()); off = []; } }; }, []);
}
