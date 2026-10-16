import { useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/modal/ConfirmDialog';
import { useAuth } from '@/features/auth';
import { cancelBooking } from '@/features/bookings';
import { RequestCancelDialog, requestsStore, type TripRequest } from '@/features/requests';
import { SendToChargerDialog } from '@/ui/SendToChargerDialog';
import { notify } from '@/ui/toast';
import { track } from '../analytics';
import { copy } from '../copy';
import type { SearchAction, SearchResult } from '../types';

/**
 * Runs a result's action: a navigation goes there, a command asks first through the app's own dialogs (send to charger, cancel a trip or a request) and then uses the app's own rules.
 * Returns the function to run an action and the dialogs to render once.
 */
export function useCommands(go: (url: string) => void): {
  run(a: SearchAction, r: SearchResult): void;
  dialogs: ReactNode;
} {
  const user = useAuth((s) => s.user)!;
  const [charger, setCharger] = useState<string | null>(null);
  const [booking, setBooking] = useState<{ id: string; trip: string } | null>(null);
  const [request, setRequest] = useState<TripRequest | null>(null);
  const run = (a: SearchAction, r: SearchResult) => {
    track({ name: 'action_run', type: r.type, id: r.id, action: a.id });
    if (a.kind === 'navigate' && a.url) return go(a.url);
    const c = a.command;
    if (!c) return;
    if (c.kind === 'charger') setCharger(c.robotId);
    else if (c.kind === 'cancel-booking') setBooking({ id: c.id, trip: r.id });
    else setRequest(requestsStore.getState().requests.find((x) => x.id === c.id) ?? null);
  };
  const dialogs = (
    <>
      <SendToChargerDialog robotId={charger} onClose={() => setCharger(null)} />
      <ConfirmDialog
        isOpen={!!booking}
        onOpenChange={(o) => !o && setBooking(null)}
        title={booking ? copy.ui.cancelTitle(booking.trip) : ''}
        description={copy.ui.cancelBody}
        confirmLabel={copy.ui.cancelConfirm}
        onConfirm={() => {
          if (booking) {
            if (!cancelBooking(booking.id, user)) notify.warning(copy.ui.cannotCancel, undefined, 'search-cancel');
          }
        }}
      />
      <RequestCancelDialog request={request} who={user} onClose={() => setRequest(null)} />
    </>
  );
  return { run, dialogs };
}
