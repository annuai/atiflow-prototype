import { useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCcw03 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
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
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <section className="rounded-xl border border-secondary bg-primary">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-tertiary outline-focus-ring hover:bg-primary_hover focus-visible:outline-2"
      >
        {copy.config.reset.zone}
        <Chevron className="size-4 text-fg-quaternary" aria-hidden />
      </button>
      {open && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-secondary px-4 py-4">
          <div className="min-w-0 max-w-md">
            <p className="text-sm font-semibold text-primary">{copy.config.reset.title}</p>
            <p className="text-sm text-tertiary">{copy.config.reset.body}</p>
          </div>
          <Button
            size="sm"
            color="tertiary-destructive"
            iconLeading={RefreshCcw03}
            isDisabled={disabled}
            onPress={() => setAsking(true)}
          >
            {copy.config.restore}
          </Button>
        </div>
      )}
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
    </section>
  );
}
