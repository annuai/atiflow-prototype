import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { copy } from '../copy';
import { ImportModal, useImportFlow } from './ImportModal';
import { MaterialsList } from './MaterialsList';

/** Materials tab: the list of all materials plus the add-materials flow. */
export function MaterialsPanel() {
  const { flow, open, dispatch } = useImportFlow();
  const [params, setParams] = useSearchParams();
  // `?add=1` (the setup steps) opens the add-materials dialog straight away
  useEffect(() => {
    if (params.get('add') !== '1') return;
    params.delete('add');
    setParams(params, { replace: true });
    open();
  }, [params, setParams, open]);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4" data-panel={copy.tabs.materials.label}>
      <MaterialsList onAdd={() => open()} onAddMore={() => open('addMore')} />
      <ImportModal flow={flow} dispatch={dispatch} />
    </div>
  );
}
