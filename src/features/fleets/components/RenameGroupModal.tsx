import { useState } from 'react';
import { Edit05 } from '@untitledui/icons';
import { FormField } from '@/components/form/FormField';
import { ModalShell } from '@/components/modal/ModalShell';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { validateGroupForm } from '../model/logic';
import { fleetsStore, profileOf, useFleets } from '../model/store';

function Body({
  fleet,
  group,
  onOpenChange,
}: {
  fleet: string;
  group: { id: string; name: string };
  onOpenChange(o: boolean): void;
}) {
  const groups = useFleets((s) => profileOf(s.profiles, fleet).groups);
  const [name, setName] = useState(group.name);
  const [error, setError] = useState('');
  const save = () => {
    const e = validateGroupForm({ name, stationId: '', codes: [] }, groups, group.id);
    if (e.name) {
      setError(e.name);
      return;
    }
    fleetsStore.getState().renameGroup(fleet, group.id, name);
    onOpenChange(false);
    notify.success(copy.groups.renamed, undefined, 'group-renamed');
  };
  return (
    <ModalShell
      isOpen
      onOpenChange={onOpenChange}
      icon={Edit05}
      title={copy.groups.rename}
      secondary={{ label: copy.groups.form.cancel, onPress: () => onOpenChange(false) }}
      primary={{ label: 'Save' }}
      onSubmit={save}
    >
      <div className="pt-2">
        <FormField
          def={{ key: 'name', label: copy.groups.form.nameLabel, control: 'text', required: true }}
          value={name}
          onChange={(v) => {
            setName(String(v));
            setError('');
          }}
          error={error}
          fleets={[]}
        />
      </div>
    </ModalShell>
  );
}
export const RenameGroupModal = (p: {
  fleet: string;
  group: { id: string; name: string } | null;
  onOpenChange(o: boolean): void;
}) => (p.group ? <Body fleet={p.fleet} group={p.group} onOpenChange={p.onOpenChange} /> : null);
