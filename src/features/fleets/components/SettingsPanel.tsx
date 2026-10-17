import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash01 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { TypeToConfirmDialog } from '@/components/modal/TypeToConfirmDialog';
import { useDataset } from '@/data/dataset';
import { useDevices } from '@/features/devices';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { deleteFleet, fleetImpact } from '../model/delete';
import { FLEETS_PATH } from '../paths';

/** Settings tab: for now only the danger zone (delete the fleet). Deleting asks for the fleet's name, says what it takes with it, and is refused while trips of the fleet are open. */
export function SettingsPanel({ fleet }: { fleet: string }) {
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
    const d = t.done(fleet);
    notify.success(d.title, d.body, 'fleet-deleted');
  };
  return (
    <section aria-labelledby="fleet-danger" className="rounded-xl border border-secondary bg-primary">
      <h2 id="fleet-danger" className="border-b border-secondary px-5 py-3 text-sm font-semibold text-error-primary">
        {t.zone}
      </h2>
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        <div className="min-w-0 max-w-xl">
          <p className="text-sm font-semibold text-primary">{t.title}</p>
          <p className="mt-1 text-sm text-tertiary">{t.body}</p>
          <p className="mt-2 text-sm text-secondary">
            {t.effects(impact.robots, impact.hardware, impact.workflows, impact.materials, impact.users)}
          </p>
          {impact.openTrips > 0 && (
            <p role="alert" className="mt-2 text-sm text-error-primary">
              {t.blocked(impact.openTrips)}
            </p>
          )}
        </div>
        <Button
          size="sm"
          color="secondary-destructive"
          iconLeading={Trash01}
          isDisabled={impact.openTrips > 0}
          onPress={() => setAsking(true)}
        >
          {t.button}
        </Button>
      </div>
      <TypeToConfirmDialog
        isOpen={asking}
        onOpenChange={setAsking}
        title={t.confirmTitle(fleet)}
        description={t.confirmBody}
        phrase={fleet}
        prompt={t.prompt(fleet)}
        confirmLabel={t.confirm}
        onConfirm={run}
      />
    </section>
  );
}
