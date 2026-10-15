import { createValidatedDocument, localBackend, type StorageBackend } from '@/data/storage';
import { BookingsDocumentSchema, type BookingsDocument } from '@/features/bookings/model/schema';
import { log } from '@/platform';
import type { BookingService } from '../ports';
import { createDocumentRepository } from './repository';

export const BOOKINGS_KEY = 'atiflow.bookings.v1';
/** DUMMY bookings: the trips operators booked from the Book trip page, kept in browser storage. */
export function createDummyBookings(backend: (key: string) => StorageBackend = localBackend): BookingService {
  const b = backend(BOOKINGS_KEY);
  const doc = createValidatedDocument({
    backend: b,
    schema: BookingsDocumentSchema,
    seed: (): BookingsDocument => ({ trips: [], seq: 0 }),
    onInvalid: (why) => log.child('bookings').warn(`saved trips ignored: ${why}`),
  });
  return createDocumentRepository({ key: BOOKINGS_KEY, backend: b, doc });
}
