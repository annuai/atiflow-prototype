import { ConfirmDialog } from '@/components/modal/ConfirmDialog';
import { copy } from '../copy';
import { cancelRequest } from '../model/actions';
import type { Person } from '../model/rules';
import type { TripRequest } from '../model/types';

/** "Cancel <material>?" for one request: only that request is cancelled, never the rest of its order. Open when `request` is set. */
export function RequestCancelDialog({
  request,
  who,
  onClose,
}: {
  request: TripRequest | null;
  who: Person & { name: string };
  onClose(): void;
}) {
  return (
    <ConfirmDialog
      isOpen={!!request}
      onOpenChange={(o) => !o && onClose()}
      title={copy.history.cancelTitle(request?.name ?? '')}
      description={copy.history.cancelBody}
      confirmLabel={copy.history.cancelConfirm}
      onConfirm={() => {
        if (request) cancelRequest(request.id, who);
      }}
    />
  );
}
