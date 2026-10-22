import { create } from 'zustand';
import { services } from '@/services';

const KEY = 'master-data:api-imported';

const useFlag = create<{ used: boolean }>(() => ({ used: services().device.get(KEY) === '1' }));

/** Whether materials were ever added from the ERP API on this device: only then does "Add more from API" make sense. */
export const useApiImported = () => useFlag((s) => s.used);

export function markApiImported() {
  services().device.set(KEY, '1');
  useFlag.setState({ used: true });
}
