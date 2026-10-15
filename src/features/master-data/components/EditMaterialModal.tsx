import { useState } from 'react';
import { Edit05 } from '@untitledui/icons';
import { ModalShell } from '@/components/modal/ModalShell';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { materialFields } from '../model/fields';
import { validateMaterial } from '../model/logic';
import { masterDataStore, useMasterData } from '../model/store';
import type { Material } from '../model/types';
import { FieldStack } from './MaterialForm';

function Body({ material, onOpenChange }: { material: Material; onOpenChange(o: boolean): void }) {
  const groups = useMasterData((s) => s.groups);
  const current = groups.find((g) => g.id === material.group)?.name ?? copy.materials.noGroup;
  const [v, setV] = useState({ name: material.name, code: material.code, group: current });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const f = materialFields(groups.map((g) => g.name));
  const save = () => {
    const e = validateMaterial(v, [], material.code);
    setErrors(e);
    if (Object.keys(e).length) return;
    masterDataStore.getState().updateMaterial(material.code, {
      name: v.name.trim(),
      groupName: v.group === copy.materials.noGroup ? '' : v.group,
    });
    onOpenChange(false);
    notify.success(copy.edit.saved, undefined, 'material-saved');
  };
  return (
    <ModalShell
      isOpen
      onOpenChange={onOpenChange}
      icon={Edit05}
      title={copy.edit.title}
      subtitle={copy.edit.subtitle}
      secondary={{ label: copy.method.cancel, onPress: () => onOpenChange(false) }}
      primary={{ label: copy.edit.save }}
      onSubmit={save}
    >
      <FieldStack
        fields={[f.name, f.code, f.group]}
        values={v}
        errors={errors}
        disabled={['code']}
        onChange={(k, val) => {
          setV((o) => ({ ...o, [k]: val }));
          setErrors((o) => ({ ...o, [k]: '' }));
        }}
      />
    </ModalShell>
  );
}
export const EditMaterialModal = ({
  material,
  onOpenChange,
}: {
  material: Material | null;
  onOpenChange(o: boolean): void;
}) => (material ? <Body key={material.code} material={material} onOpenChange={onOpenChange} /> : null);
