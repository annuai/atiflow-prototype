import type { TripIdCounter } from '@/services/ports';
/**
 * THE source of trip ids (TRP-001, TRP-002...). A request gets its trip id the moment it is made (before approval), the simulator takes the same ids for its own trips,
 * so an id is unique across both and a supervisor can search any of them. The counter lives behind the `tripIds` service (the dummy one keeps it in the browser so ids keep counting after a reload; a fleet manager owns it later).
 */
let seq: number | null = null;
/** Where the counter is kept: installed by `setServices` (the services' `tripIds`); until then (tests that never install services) it lives in memory. */
let source: TripIdCounter = (() => {
  let n = 0;
  return { read: () => n, write: (v: number) => void (n = v) };
})();
export function installTripIdCounter(next: TripIdCounter) {
  source = next;
  seq = null; // read again from the new source
}
const counter = () => source;
const current = () => (seq ??= counter().read()); // read on first use, so the services chosen at start-up are the ones used
const save = () => counter().write(current());
const formatTripId = (n: number) => `TRP-${String(n).padStart(3, '0')}`;
export const tripNumber = (id: string) => parseInt(id.slice(4), 10) || 0;
export interface TripIdSource {
  next(): string;
  /** give the last id back (it was not used) */ undo(): void;
}
export const tripIds: TripIdSource & {
  /** never hand out an id at or below `n` again (ids already in use, e.g. saved requests) */ ensureAtLeast(
    n: number,
  ): void;
  reset(): void;
} = {
  next() {
    seq = current() + 1;
    save();
    return formatTripId(seq);
  },
  undo() {
    seq = Math.max(0, current() - 1);
    save();
  },
  ensureAtLeast(n) {
    if (n > current()) {
      seq = n;
      save();
    }
  },
  reset() {
    seq = 0;
    save();
  },
};
