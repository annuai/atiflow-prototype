import { datasetStore } from '@/data/dataset';
import { masterDataStore } from '@/features/master-data/model/store';
import { fleetNameError } from '@/features/workflow-builder/model/names';
import { wfStore } from '@/features/workflow-builder/model/store';
import { fleetsStore } from './store';

/**
 * Rename a fleet everywhere it is referenced: fleet list + workflows' fleet, fleet profile (map, station groups), robots / hardware, material assignments.
 * Workflow names are deliberately left alone (they are edited by hand). Returns an error text, or '' when renamed.
 */
export function renameFleet(from: string, to: string): string {
  const name = to.trim();
  const error = fleetNameError(
    name,
    datasetStore.getState().fleets.map((f) => f.name),
    from,
  );
  if (error) return error;
  if (name === from) return '';
  wfStore.getState().renameFleet(from, name);
  fleetsStore.getState().renameProfile(from, name);
  datasetStore.getState().renameFleet(from, name);
  masterDataStore.getState().renameFleet(from, name);
  return '';
}
