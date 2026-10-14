import { feed } from '@/features/live-floor/liveFeed';
import { notify } from '@/ui/toast';
import { takeBack } from './bridge';
import { canCancel, type Person } from './rules';
import { requestsStore } from './store';

/**
 * Cancel one request. While it still waits for a robot the order is taken back from the floor first; if a robot has already started with it (the floor no longer holds
 * the order) the cancel is refused and the status follows from the floor's report a moment later. With the floor not running nothing was handed over, so it just cancels.
 */
export function cancelRequest(id: string, who: Person & { name: string }): boolean {
  const r = requestsStore.getState().requests.find((x) => x.id === id); if (!r || !canCancel(r, who)) return false;
  if (r.status === 'approved' && feed.orders.running && !takeBack(id)) { notify.warning('A robot is already on its way', 'This request can no longer be cancelled.', 'cancel-late'); return false; }
  const ok = requestsStore.getState().cancel(id, who); if (ok) notify.success(`${r.name} cancelled`, r.id, 'cancel-ok'); return ok;
}
