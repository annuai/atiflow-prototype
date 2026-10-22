import { useState } from 'react';
import { Button } from '@/components/base/buttons/button';
import { Select } from '@/components/base/select/select';
import { ConfirmDialog } from '@/components/modal/ConfirmDialog';
import { SettingsRow } from '@/components/data/SettingsRow';
import { PROFILE_IDS, activeProfile, resetProfile, switchProfile, type ProfileId } from '@/data/profile';
import { copy } from '../copy';

const label = (id: ProfileId) => (id === 'blank' ? copy.workspace.blank : copy.workspace.demo);

/** Which data this browser works on: the demo data or an empty workspace. Both are kept; switching only chooses which one is shown (the page reloads). */
export function WorkspacePanel() {
  const current = activeProfile().id;
  const [next, setNext] = useState<ProfileId>(current);
  const [asking, setAsking] = useState(false);
  const [resetting, setResetting] = useState(false);
  return (
    <div className="mt-8 flex max-w-4xl flex-col border-t border-secondary pt-2">
      <SettingsRow label={copy.workspace.label} hint={copy.workspace.hint}>
        <div className="flex gap-3">
          <Select
            aria-label={copy.workspace.label}
            className="flex-1"
            selectedKey={next}
            onSelectionChange={(k) => setNext(String(k) as ProfileId)}
            items={PROFILE_IDS.map((id) => ({ id, label: label(id) }))}
          >
            {(item) => <Select.Item {...item} />}
          </Select>
          <Button size="md" color="secondary" isDisabled={next === current} onPress={() => setAsking(true)}>
            {copy.workspace.switch}
          </Button>
        </div>
      </SettingsRow>
      {current !== 'demo' && (
        <SettingsRow label={copy.workspace.reset}>
          <div>
            <Button size="md" color="secondary-destructive" onPress={() => setResetting(true)}>
              {copy.workspace.resetConfirm}
            </Button>
          </div>
        </SettingsRow>
      )}
      <ConfirmDialog
        isOpen={resetting}
        onOpenChange={setResetting}
        title={copy.workspace.reset}
        description={copy.workspace.resetBody}
        confirmLabel={copy.workspace.resetConfirm}
        onConfirm={() => void resetProfile(current)}
      />
      <ConfirmDialog
        isOpen={asking}
        onOpenChange={setAsking}
        title={copy.workspace.confirmTitle(label(next))}
        description={copy.workspace.confirmBody}
        confirmLabel={copy.workspace.confirm}
        onConfirm={() => switchProfile(next)}
      />
    </div>
  );
}
