import { STATUS } from '@/features/requests';
import { t } from '../text';
import type { BookingInput, BookedTrip } from './types';

/** What is wrong with a booking (pure): '' = fine. */
export function bookingError(b: Partial<BookingInput>): string {
  if (!b.robotType) return t.bookings.rules.robot;
  if (!b.from) return t.bookings.rules.from;
  if (!b.to) return t.bookings.rules.to;
  return b.from === b.to ? t.bookings.rules.same : '';
}
/** The person who booked a trip may cancel it until a robot is on its way. */
export const canCancelBooking = (t: BookedTrip, who: { username: string }): boolean =>
  t.bookedBy === who.username && STATUS[t.status].cancellable;
