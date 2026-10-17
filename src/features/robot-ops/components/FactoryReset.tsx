import { useState } from 'react';
import { RefreshCcw03 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { DangerZone } from '@/components/data/DangerZone';
import { TypeToConfirmDialog } from '@/components/modal/TypeToConfirmDialog';
import { copy } from '../copy';

/**
 * Restoring factory settings is destructive and hard to undo, so it is buried on purpose: it only exists under Advanced Settings, behind a collapsed "Danger zone", as a quiet
 * tertiary button that opens a dialog where the robot's name has to be typed. Not available while the configuration is being edited or saved.
 */
export function FactoryReset({
  robotName,
  disabled,
  onRestore,
}: {
  robotName: string;
  disabled: boolean;
  onRestore(): void;
}) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <DangerZone
        label={copy.config.reset.zone}
        title={copy.config.reset.title}
        description={copy.config.reset.body}
        action={
          <Button
            size="sm"
            color="tertiary-destructive"
            iconLeading={RefreshCcw03}
            isDisabled={disabled}
            onPress={() => setAsking(true)}
          >
            {copy.config.restore}
          </Button>
        }
      />
      <TypeToConfirmDialog
        isOpen={asking}
        onOpenChange={setAsking}
        title={copy.config.restoreTitle(robotName)}
        description={copy.config.restoreBody}
        phrase={robotName}
        prompt={copy.config.reset.prompt(robotName)}
        confirmLabel={copy.config.restoreConfirm}
        onConfirm={onRestore}
      />
    </>
  );
}
