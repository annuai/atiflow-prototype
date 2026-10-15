import { useState } from 'react';
import { services } from '@/services';
import { notify } from '@/ui/toast';
import { useResource } from '@/hooks/use-resource';
import { CALIBRATIONS } from '../model/calibration';
import type { CalibrationKind, CalibrationStatus, RobotRef } from '../model/types';
import { copy } from '../copy';

/** The calibration status of one robot and the action to run one. While a run is under way its row shows as running (the service resolves when it is done). */
export function useCalibration(robot: RobotRef) {
  const ops = services().robotOps;
  const list = useResource<CalibrationStatus[]>(() => ops.calibration.list(robot), robot.name);
  const [running, setRunning] = useState<CalibrationKind | null>(null);
  return {
    items: list.data?.map((s) => (s.kind === running ? { ...s, running: true } : s)),
    loading: list.loading,
    error: list.error,
    reload: list.reload,
    anyRunning: running !== null || !!list.data?.some((s) => s.running),
    async run(kind: CalibrationKind) {
      setRunning(kind);
      try {
        const done = await ops.calibration.run(robot, kind);
        list.set((list.data ?? []).map((s) => (s.kind === kind ? done : s)));
        notify.success(
          copy.calibration.done(CALIBRATIONS.find((c) => c.kind === kind)?.title ?? 'Calibration'),
          undefined,
          'robot-calibration',
        );
      } catch (e) {
        notify.error(copy.calibration.failed, e instanceof Error ? e.message : undefined, 'robot-calibration');
      } finally {
        setRunning(null);
      }
    },
  };
}
