import { useState } from 'react';
import { useFleetName } from '@/data/fleetDirectory';
import { useNavigate } from 'react-router-dom';
import { Trash01 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { DangerZone } from '@/components/data/DangerZone';
import { TypeToConfirmDialog } from '@/components/modal/TypeToConfirmDialog';
import { useDataset } from '@/data/dataset';
import { useDevices } from '@/features/devices';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { deleteFleet, fleetImpact } from '../model/delete';
import { FLEETS_PATH } from '../paths';
import type { FleetId } from '@/data/fleets';

/** Settings tab: for now only the danger zone (delete the fleet). Deleting asks for the fleet's name, says what it takes with it, and is refused while trips of the fleet are open. */
export function SettingsPanel({ fleet }: { fleet: FleetId }) {
  const fleetName = useFleetName(fleet);
  const t = copy.settings;
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  // the impact is read when the panel redraws: these hooks make it redraw when robots / hardware / fleets change
  useDevices((s) => s.robot);
  useDataset((s) => s.fleets);
  const impact = fleetImpact(fleet);
  const run = () => {
    if (!deleteFleet(fleet)) return;
    navigate(FLEETS_PATH, { replace: true });
    const d = t.done(fleetName);
    notify.success(d.title, d.body, 'fleet-deleted');
  };
  return (
    <>
      <DangerZone
        label={t.zone}
        title={t.title}
        description={t.body}
        action={
          <Button
            size="sm"
            color="tertiary-destructive"
            iconLeading={Trash01}
            isDisabled={impact.openTrips > 0}
            onPress={() => setAsking(true)}
          >
            {t.button}
          </Button>
        }
      >
        <p className="mt-2 text-sm text-secondary">
          {t.effects(impact.robots, impact.hardware, impact.workflows, impact.materials, impact.users)}
        </p>
        {impact.openTrips > 0 && (
          <p role="alert" className="mt-2 text-sm text-error-primary">
            {t.blocked(impact.openTrips)}
          </p>
        )}
      </DangerZone>
      <TypeToConfirmDialog
        isOpen={asking}
        onOpenChange={setAsking}
        title={t.confirmTitle(fleetName)}
        description={t.confirmBody}
        phrase={fleetName}
        prompt={t.prompt(fleetName)}
        confirmLabel={t.confirm}
        onConfirm={run}
      />
    </>
  );
}
