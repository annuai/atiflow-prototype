import { BatteryCharging01 } from '@untitledui/icons';
import { ModalShell } from '@/components/modal/ModalShell';
import { localized } from '@/i18n';
import type { ChargeResult } from '../core/types';
import { copy } from './copy';
import { handle } from './engineHandle';
import { notify } from './toast';

/** Asks first, then sends the robot to a charger and says what happened (or why the fleet refused). Used by the robot window and by search. */
export function SendToChargerDialog({ robotId, onClose }: { robotId: string | null; onClose(): void }) {
  const c = copy.charger;
  const run = () => {
    if (!robotId) return;
    const r: ChargeResult = handle.sendToCharger?.(robotId) ?? { ok: false, reason: 'not-running' };
    if (r.ok) notify.success(r.when === 'now' ? c.now(robotId) : c.later(robotId), undefined, 'charger');
    else notify.warning(c.refused[r.reason](robotId, r.tripId ?? ''), undefined, 'charger');
    onClose();
  };
  return (
    <ModalShell
      isOpen={!!robotId}
      onOpenChange={(o) => !o && onClose()}
      icon={BatteryCharging01}
      title={robotId ? c.title(robotId) : ''}
      subtitle={c.body}
      secondary={{ label: localized('common').cancel, onPress: onClose }}
      primary={{ label: c.confirm, onPress: run }}
    >
      {null}
    </ModalShell>
  );
}
