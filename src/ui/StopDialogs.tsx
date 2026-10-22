import { useState } from 'react';
import { AlertOctagon, PlayCircle } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { useApp } from '../core/store';
import { ModalShell } from '@/components/modal/ModalShell';
import { localized } from '@/i18n';
import type { StopResult } from '../core/types';
import { copy } from './copy';
import { handle } from './engineHandle';
import { notify } from './toast';

const refusal = (r: Extract<StopResult, { ok: false }>) => copy.estop.refused[r.reason];

/** Asks first, then stops one robot where it stands (supervisors only; the robot window offers it). */
export function EmergencyStopDialog({ robotId, onClose }: { robotId: string | null; onClose(): void }) {
  const c = copy.estop;
  const run = () => {
    if (!robotId) return;
    const r: StopResult = handle.emergencyStop?.(robotId) ?? { ok: false, reason: 'not-running' };
    if (r.ok) notify.success(c.robotDone(robotId), undefined, 'estop');
    else notify.warning(refusal(r), undefined, 'estop');
    onClose();
  };
  return (
    <ModalShell
      isOpen={!!robotId}
      onOpenChange={(o) => !o && onClose()}
      icon={AlertOctagon}
      title={robotId ? c.robotTitle(robotId) : ''}
      subtitle={c.robotBody}
      secondary={{ label: localized('common').cancel, onPress: onClose }}
      primary={{ label: c.robotConfirm, destructive: true, onPress: run }}
    >
      {null}
    </ModalShell>
  );
}

/** Stop every robot of a fleet (`stop`), or let them all carry on. Asks first. */
export function StopFleetDialog({
  fleet,
  stop,
  onClose,
}: {
  fleet: { id: string; name: string } | null;
  stop: boolean;
  onClose(): void;
}) {
  const c = copy.estop;
  const run = () => {
    if (!fleet) return;
    const r: StopResult = handle.stopFleet?.(fleet.id, stop) ?? { ok: false, reason: 'not-running' };
    if (r.ok) notify.success((stop ? c.fleetDone : c.resumeDone)(r.count), undefined, 'estop');
    else notify.warning(refusal(r), undefined, 'estop');
    onClose();
  };
  return (
    <ModalShell
      isOpen={!!fleet}
      onOpenChange={(o) => !o && onClose()}
      icon={AlertOctagon}
      title={fleet ? (stop ? c.fleetTitle : c.resumeTitle)(fleet.name) : ''}
      subtitle={stop ? c.fleetBody : c.resumeBody}
      secondary={{ label: localized('common').cancel, onPress: onClose }}
      primary={{ label: stop ? c.fleetConfirm : c.resumeConfirm, destructive: stop, onPress: run }}
    >
      {null}
    </ModalShell>
  );
}

/** The header button of the Live Floor (supervisors): stops the fleet that is shown, or resumes it when all its robots are stopped. */
export function StopFleetButton() {
  const fleetId = useApp((s) => s.fleetId);
  const fleets = useApp((s) => s.fleets);
  const robots = useApp((s) => s.robots);
  const [open, setOpen] = useState(false);
  const fleet = fleets.find((f) => f.id === fleetId);
  const mine = Object.values(robots).filter((r) => r.fleetId === fleetId && r.state !== 'offline');
  if (!fleet || !mine.length) return null;
  const stopped = mine.every((r) => r.state === 'paused');
  return (
    <>
      <Button
        size="sm"
        color={stopped ? 'secondary' : 'secondary-destructive'}
        iconLeading={stopped ? PlayCircle : AlertOctagon}
        onPress={() => setOpen(true)}
      >
        {stopped ? copy.estop.resumeButton : copy.estop.fleetButton}
      </Button>
      <StopFleetDialog fleet={open ? fleet : null} stop={!stopped} onClose={() => setOpen(false)} />
    </>
  );
}
