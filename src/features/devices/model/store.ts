import { datasetStore, useDataset, type DatasetState } from '@/data/dataset';
import type { DeviceKindId, FieldValue } from './types';

/**
 * Robots and hardware live in the shared dataset (`data/dataset.ts`); this keeps the names the devices feature already uses.
 * `deviceStore.getState()` has the two lists and add / update / remove.
 */
type Facade = Pick<DatasetState, 'robot' | 'hardware'> & {
  add(kind: DeviceKindId, values: Record<string, FieldValue>): void;
  update(kind: DeviceKindId, name: string, values: Record<string, FieldValue>): void;
  remove(kind: DeviceKindId, name: string): void;
};
const view = (s: DatasetState): Facade => ({
  robot: s.robot,
  hardware: s.hardware,
  add: s.addDevice,
  update: s.updateDevice,
  remove: s.removeDevice,
});
export const deviceStore = {
  getState: () => view(datasetStore.getState()),
  setState: (p: Partial<Pick<DatasetState, 'robot' | 'hardware'>>) => datasetStore.setState(p),
  subscribe: datasetStore.subscribe,
};
export const useDevices = <T>(sel: (s: Facade) => T): T => {
  const robot = useDataset((s) => s.robot),
    hardware = useDataset((s) => s.hardware);
  return sel({ ...view(datasetStore.getState()), robot, hardware });
};
