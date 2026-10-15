/**
 * THE source of trip ids (TRP-001, TRP-002...). A request gets its trip id the moment it is made (before approval), the simulator takes the same ids for its own trips,
 * so an id is unique across both and a supervisor can search any of them. The counter is kept in the browser so ids keep counting after a reload; a fleet manager would own it later.
 */
const KEY = 'atiflow.tripseq';
let seq = 0;
try {
  seq = +(localStorage.getItem(KEY) ?? 0) || 0;
} catch {
  /* no storage (tests) */
}
const save = () => {
  try {
    localStorage.setItem(KEY, String(seq));
  } catch {
    /* not saved */
  }
};
export const formatTripId = (n: number) => `TRP-${String(n).padStart(3, '0')}`;
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
    seq++;
    save();
    return formatTripId(seq);
  },
  undo() {
    seq = Math.max(0, seq - 1);
    save();
  },
  ensureAtLeast(n) {
    if (n > seq) {
      seq = n;
      save();
    }
  },
  reset() {
    seq = 0;
    save();
  },
};
