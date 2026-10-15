import { useState } from 'react';
import { Target04 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { ModalShell } from '@/components/modal/ModalShell';
import { useNow } from '@/hooks/use-now';
import { copy } from '../copy';
import { useCalibration } from '../data/useCalibration';
import { CALIBRATIONS, calibrationBlocked, describeCalibration } from '../model/calibration';
import type { CalibrationKind, RobotRef } from '../model/types';
import { RowSkeleton, TabHeader, TabState } from './TabParts';

/** The Calibration tab: one row per calibration (when it was last done, what it covers) and a Calibrate button. A robot that is offline cannot be calibrated. */
export function CalibrationTab({ robot, online }: { robot: RobotRef; online: boolean }) {
  const cal = useCalibration(robot);
  const [asking, setAsking] = useState<CalibrationKind | null>(null);
  const now = useNow();
  const blocked = calibrationBlocked(online, cal.anyRunning);
  const asked = CALIBRATIONS.find((c) => c.kind === asking);
  return (
    <div className="flex flex-col gap-6">
      <TabHeader title={copy.calibration.title} subtitle={copy.calibration.subtitle} />
      <TabState
        loading={cal.loading && !cal.items}
        error={cal.error}
        failTitle={copy.calibration.loadFailed}
        onRetry={cal.reload}
        skeleton={
          <div className="flex flex-col gap-3">
            <RowSkeleton />
            <RowSkeleton />
          </div>
        }
      />
      {cal.items && (
        <ul className="flex flex-col gap-3">
          {CALIBRATIONS.map((c) => {
            const status = cal.items!.find((s) => s.kind === c.kind);
            if (!status) return null;
            return (
              <li
                key={c.kind}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-secondary bg-primary p-4 shadow-xs sm:p-5"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary text-fg-quaternary">
                  <Target04 className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-md font-semibold text-primary">{c.title}</p>
                  <p className="text-sm text-tertiary">
                    {describeCalibration(status, now)} · {c.detail}
                  </p>
                  {blocked && !status.running && <p className="mt-1 text-xs text-quaternary">{blocked}</p>}
                </div>
                <Button
                  size="md"
                  color="secondary"
                  iconLeading={Target04}
                  isLoading={status.running}
                  isDisabled={!!blocked && !status.running}
                  onPress={() => setAsking(c.kind)}
                >
                  {status.running ? copy.calibration.running : copy.calibration.action}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <ModalShell
        isOpen={!!asking}
        onOpenChange={(o) => !o && setAsking(null)}
        icon={Target04}
        title={copy.calibration.confirmTitle(asked?.title ?? '')}
        subtitle={copy.calibration.confirmBody}
        secondary={{ label: copy.config.cancel, onPress: () => setAsking(null) }}
        primary={{
          label: copy.calibration.action,
          onPress: () => {
            const k = asking;
            setAsking(null);
            if (k) void cal.run(k);
          },
        }}
      >
        <span />
      </ModalShell>
    </div>
  );
}
