import { Target04 } from '@untitledui/icons';
import { ModalShell } from '@/components/modal/ModalShell';
import { localized } from '@/i18n';
import type { RelocalizeResult } from '../core/types';
import { copy } from './copy';
import { handle } from './engineHandle';
import { notify } from './toast';

/** Asks first, then tells the robot to find its place on the map again (after someone moved it onto a lane by hand) and says what happened. Used by the robot window only. */
export function RelocalizeDialog({ robotId, onClose }: { robotId: string | null; onClose(): void }) {
  const c = copy.relocalize;
  const run = () => {
    if (!robotId) return;
    const r: RelocalizeResult = handle.relocalize?.(robotId) ?? { ok: false, reason: 'not-running' };
    if (r.ok) notify.success(c.done(robotId), undefined, 'relocalize');
    else notify.warning(c.refused[r.reason](robotId), undefined, 'relocalize');
    onClose();
  };
  return (
    <ModalShell
      isOpen={!!robotId}
      onOpenChange={(o) => !o && onClose()}
      icon={Target04}
      title={robotId ? c.title(robotId) : ''}
      subtitle={c.body}
      secondary={{ label: localized('common').cancel, onPress: onClose }}
      primary={{ label: c.confirm, onPress: run }}
    >
      {null}
    </ModalShell>
  );
}
