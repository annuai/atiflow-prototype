import { createStore } from 'zustand/vanilla';
import { services } from '@/services';

const KEY = 'supervisor-fleet-filter';
const saved = () => {
  try {
    return services().device.get(KEY) ?? 'all';
  } catch {
    return 'all'; // services not installed (a unit test): nothing was saved
  }
};

/** Which fleet the supervisor's Dashboard and Reports are about: 'all' (every fleet the person can see, combined) or one fleet's id (the id its robots carry). Remembered on this device. */
export const fleetFilterStore = createStore<{ fleetId: string; choose(id: string): void }>((set) => ({
  fleetId: saved(),
  choose: (id) => {
    set({ fleetId: id });
    try {
      services().device.set(KEY, id);
    } catch {
      /* not remembered: harmless */
    }
  },
}));
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __fleetFilter: fleetFilterStore }); // dev-only handle for console testing
