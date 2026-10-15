import { feed } from '@/features/live-floor';
import { notify } from '@/ui/toast';
import { t as text } from '../text';
import { takeBack } from './bridge';
import { canCancelBooking } from './rules';
import { bookingsStore } from './store';

/** Cancel a booked trip: taken back from the floor first while it waits for a robot; refused once a robot is on its way. */
export function cancelBooking(id: string, who: { username: string }): boolean {
  const t = bookingsStore.getState().trips.find((x) => x.id === id);
  if (!t || !canCancelBooking(t, who)) return false;
  if (t.status === 'approved' && feed.orders.running && !takeBack(id)) {
    notify.warning(text.bookings.cancelLate.title, text.bookings.cancelLate.body, 'cancel-late');
    return false;
  }
  const ok = bookingsStore.getState().cancel(id, who);
  if (ok) notify.success(text.bookings.cancelled, t.tripId, 'cancel-ok');
  return ok;
}
