import { Server01 } from '@untitledui/icons';
import { EmptyState } from '@/components/data/EmptyState';
import { useState } from 'react';
import { Flag01 } from '@untitledui/icons';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { ModalShell } from '@/components/modal/ModalShell';
import { fleetDirectory, useFleetChoices } from '@/data/fleetDirectory';
import { fleetsUsingMaterial, wfStore } from '@/features/workflow-builder';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { masterDataStore } from '../model/store';
import type { Material } from '../model/types';

function Body({ material, onOpenChange }: { material: Material; onOpenChange(o: boolean): void }) {
  const fleets = useFleetChoices();
  const [sel, setSel] = useState(material.fleets);
  const save = () => {
    const blocked = material.fleets.filter(
      (f) => !sel.includes(f) && fleetsUsingMaterial(wfStore.getState().workflows, material.code).includes(f),
    ); // unassigning a material a workflow still uses is refused
    if (blocked.length) {
      notify.warning(
        copy.fleets.inUse.title,
        copy.fleets.inUse.body(
          material.code,
          blocked.map((f) => fleetDirectory.nameOf(f)),
        ),
        'material-in-use',
      );
      setSel([...sel, ...blocked]);
      return;
    }
    masterDataStore.getState().setMaterialFleets(material.code, sel);
    onOpenChange(false);
  };
  return (
    <ModalShell
      isOpen
      onOpenChange={onOpenChange}
      icon={Flag01}
      title={copy.fleets.title(material.code)}
      subtitle={copy.fleets.subtitle}
      secondary={{ label: copy.method.cancel, onPress: () => onOpenChange(false) }}
      primary={{ label: copy.fleets.save, onPress: save }}
    >
      <div className="flex flex-col gap-3 pt-2">
        {fleets.length === 0 && (
          <EmptyState icon={Server01} title={copy.emptyTitles.fleets} subtext={copy.fleets.none} size="sm" />
        )}
        {fleets.map((f) => (
          <Checkbox
            key={f.id}
            size="sm"
            label={f.label}
            isSelected={sel.includes(f.id)}
            onChange={(on) => setSel(on ? [...sel, f.id] : sel.filter((x) => x !== f.id))}
          />
        ))}
      </div>
    </ModalShell>
  );
}
/** Assign a material to fleets. (The fleet pages will own this later; until then it is reachable from the row menu.) */
export const FleetsModal = ({
  material,
  onOpenChange,
}: {
  material: Material | null;
  onOpenChange(o: boolean): void;
}) => (material ? <Body key={material.code} material={material} onOpenChange={onOpenChange} /> : null);
