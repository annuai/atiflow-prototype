import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { OrderUpdate } from '@/core/types';
import { tripIds, tripNumber } from '@/core/tripIds';
import { services } from '@/services';
import { isAllowedNext } from '@/features/requests/model/rules';
import type { RequestStatus } from '@/features/requests/model/types';
import { bookingError, canCancelBooking } from './rules';
import type { BookedTrip, BookingInput } from './types';

/** Every booked trip (history included), saved in this browser (`StorageBackend`: a server later = another backend). Handing trips to the fleet and taking updates back is `bridge.ts`. */
interface Saved {
  trips: BookedTrip[];
  seq: number;
}

export interface BookingsState extends Saved {
  /** Book a trip: it gets its trip id now and waits for a robot (Approved). Returns the trip, or null with nothing booked when the booking is not valid. */
  book(who: { username: string; name: string }, input: BookingInput, now?: number): BookedTrip | null;
  cancel(id: string, who: { username: string }, now?: number): boolean;
  /** The fleet reported something about the trip. */
  apply(u: OrderUpdate, now?: number): void;
  /** The floor restarted: trips that were on their way wait for a robot again. */
  requeueOngoing(now?: number): void;
  reset(): void;
}
const push = (t: BookedTrip, status: RequestStatus, at: number, by?: string, note?: string): BookedTrip => ({
  ...t,
  status,
  history: [...t.history, { status, at, by, note }],
});
const boot: Saved = services().bookings.snapshot() as Saved;
tripIds.ensureAtLeast(Math.max(0, ...boot.trips.map((t) => tripNumber(t.tripId))));

export const bookingsStore = createStore<BookingsState>((set, get) => ({
  ...boot,
  book(who, input, now = Date.now()) {
    if (bookingError(input)) return null;
    const seq = get().seq + 1;
    const trip: BookedTrip = push(
      {
        id: `BKG-${String(seq).padStart(4, '0')}`,
        tripId: tripIds.next(),
        ...input,
        status: 'approved',
        history: [],
        bookedBy: who.username,
        bookedByName: who.name,
        createdAt: now,
      },
      'approved',
      now,
      who.name,
      'Booked',
    );
    set({ seq, trips: [...get().trips, trip] });
    return trip;
  },
  cancel(id, who, now = Date.now()) {
    const t = get().trips.find((x) => x.id === id);
    if (!t || !canCancelBooking(t, who)) return false;
    set({ trips: get().trips.map((x) => (x.id === id ? push(x, 'cancelled', now, who.username) : x)) });
    return true;
  },
  apply(u, now = Date.now()) {
    const t = get().trips.find((x) => x.id === u.id);
    if (!t) return;
    const to: RequestStatus = u.status;
    if (t.status === to && !(to === 'ongoing' && u.tripId && u.tripId !== t.tripId)) return;
    if (!isAllowedNext(t.status, to) && !(t.status === 'ongoing' && to === 'ongoing')) return;
    set({
      trips: get().trips.map((x) =>
        x.id === u.id
          ? {
              ...push(x, to, now, 'Fleet', u.reason),
              tripId: u.tripId ?? x.tripId,
              robotId: u.robotId ?? x.robotId,
              note: u.reason ?? x.note,
            }
          : x,
      ),
    });
  },
  requeueOngoing(now = Date.now()) {
    if (!get().trips.some((t) => t.status === 'ongoing')) return;
    set({
      trips: get().trips.map((t) =>
        t.status === 'ongoing'
          ? {
              ...push(t, 'approved', now, 'Fleet', 'The fleet restarted: waiting for a robot again'),
              robotId: undefined,
            }
          : t,
      ),
    });
  },
  reset() {
    services().bookings.resetToSeed?.();
    set({ trips: [], seq: 0 });
  },
}));
export const useBookings = <T>(sel: (s: BookingsState) => T) => useStore(bookingsStore, sel);

let timer: ReturnType<typeof setTimeout> | undefined;
let saved = bookingsStore.getState();
bookingsStore.subscribe((s) => {
  if (s.trips === saved.trips && s.seq === saved.seq) return;
  saved = s;
  clearTimeout(timer);
  timer = setTimeout(() => void services().bookings.save({ trips: s.trips, seq: s.seq }), 150);
});
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __bookings: bookingsStore });
