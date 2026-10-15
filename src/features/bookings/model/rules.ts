import { STATUS } from '@/features/requests/model/status';
import type { BookingInput, BookedTrip } from './types';

/** What is wrong with a booking (pure): '' = fine. */
export function bookingError(b: Partial<BookingInput>): string {
  if (!b.robotType) return 'Choose the robot to call.'; if (!b.from) return 'Choose the start station.'; if (!b.to) return 'Choose the end station.';
  return b.from === b.to ? 'The start and end station must be different.' : '';
}
/** The person who booked a trip may cancel it until a robot is on its way. */
export const canCancelBooking = (t: BookedTrip, who: { username: string }): boolean => t.bookedBy === who.username && STATUS[t.status].cancellable;
