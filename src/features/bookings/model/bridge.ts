import { useEffect } from 'react';
import { feed } from '@/features/live-floor/liveFeed';
import { bookingsStore } from './store';
import type { BookedTrip } from './types';

/**
 * Connects booked trips to the fleet: a booked trip becomes a transport order for the floor (a robot of the chosen type drives to the start station, then carries to the end station), and the
 * floor's reports come back as statuses. Running while a booking page is on screen (one shared run). If the floor restarts, trips that were not finished are handed over again.
 */
const orderOf = (t: BookedTrip) => ({
  id: t.id,
  tripId: t.tripId,
  fleetId: t.fleetLive,
  legs: [t.from, t.to],
  loadFrom: 1,
  payload: { kind: 'Custom trip', qty: 1 },
  robotModel: t.robotType,
});
const handedOver = new Set<string>();
const send = (t: BookedTrip) => {
  handedOver.add(t.id);
  if (!feed.orders.submit(orderOf(t))) handedOver.delete(t.id);
};
const handOverAll = () =>
  bookingsStore.getState().trips.forEach((t) => {
    if (t.status === 'approved' || t.status === 'ongoing') send(t);
  });
const handOverNew = () =>
  bookingsStore.getState().trips.forEach((t) => {
    if (t.status === 'approved' && !handedOver.has(t.id) && feed.orders.running) send(t);
  });
/** A cancelled trip is taken back from the floor while no robot is on its way with it. */
export function takeBack(id: string): boolean {
  handedOver.delete(id);
  return feed.orders.cancel(id);
}

let users = 0,
  off: (() => void)[] = [];
function start() {
  const release = feed.acquire();
  void feed.ready();
  const offUpdate = feed.orders.onUpdate((u) => bookingsStore.getState().apply(u));
  const offStart = feed.orders.onStart(() => {
    handedOver.clear();
    bookingsStore.getState().requeueOngoing();
    handOverAll();
  });
  const offStore = bookingsStore.subscribe(handOverNew);
  handOverNew();
  off = [offUpdate, offStart, offStore, release];
}
/** Keep booked trips flowing to the floor while the component is mounted. */
export function useBookingsRunning() {
  useEffect(() => {
    if (users++ === 0) start();
    return () => {
      if (--users === 0) {
        off.forEach((f) => f());
        off = [];
      }
    };
  }, []);
}
