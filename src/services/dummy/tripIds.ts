import { localBackend, type StorageBackend } from '@/data/storage';
import type { TripIdCounter } from '../ports';

export const TRIP_SEQ_KEY = 'atiflow.tripseq';
/** DUMMY trip-id counter: the last number handed out, kept in browser storage so ids keep counting after a reload. */
export function createDummyTripIds(backend: (key: string) => StorageBackend = localBackend): TripIdCounter {
  const b = backend(TRIP_SEQ_KEY);
  return {
    read: () => Number(b.read() ?? 0) || 0,
    write: (n) => b.write(String(n)),
  };
}
