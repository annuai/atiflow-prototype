import { ConfirmDialog } from '@/components/modal/ConfirmDialog';
import { fleetsUsingMaterial, wfStore } from '@/features/workflow-builder';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { masterDataStore } from '../model/store';
import type { Material } from '../model/types';

/** Confirms taking a material out of Master Data. Refused (with the fleets named) while a workflow still uses it. */
export function RemoveMaterialDialog({
  material,
  onOpenChange,
}: {
  material: Material | null;
  onOpenChange(o: boolean): void;
}) {
  const remove = () => {
    if (!material) return;
    const used = fleetsUsingMaterial(wfStore.getState().workflows, material.code);
    if (used.length) {
      notify.warning(
        copy.materials.remove.inUse.title,
        copy.materials.remove.inUse.body(material.code, used),
        'material-in-use',
      );
      return;
    }
    masterDataStore.getState().removeMaterial(material.code);
  };
  return (
    <ConfirmDialog
      isOpen={!!material}
      onOpenChange={onOpenChange}
      title={copy.materials.remove.title(material?.name ?? '')}
      description={copy.materials.remove.description(material?.code ?? '')}
      confirmLabel={copy.materials.remove.confirm}
      onConfirm={remove}
    />
  );
}
