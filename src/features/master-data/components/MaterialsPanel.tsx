import { copy } from '../copy';
import { ImportModal, useImportFlow } from './ImportModal';
import { MaterialsList } from './MaterialsList';

/** Materials tab: the list of all materials plus the add-materials flow. */
export function MaterialsPanel() {
  const { flow, open, dispatch } = useImportFlow();
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4" data-panel={copy.tabs.materials.label}>
      <MaterialsList onAdd={() => open()} onAddMore={() => open('addMore')} />
      <ImportModal flow={flow} dispatch={dispatch} />
    </div>
  );
}
