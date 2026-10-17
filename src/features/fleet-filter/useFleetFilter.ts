import { useStore } from 'zustand';
import { useFleetOptions } from '@/features/auth';
import { fleetFilterStore } from './store';

/**
 * The fleet filter as the pages read it. `fleetId` is 'all' or one fleet the person can see (a choice that is no longer valid, or a person with one fleet only, is "all": nothing to
 * choose); `scope` is that fleet's id, or undefined for all of them: what a data source takes.
 */
export function useFleetFilter() {
  const chosen = useStore(fleetFilterStore, (s) => s.fleetId);
  const options = useFleetOptions();
  const many = options.length > 1;
  const fleetId = many && options.some((o) => o.id === chosen) ? chosen : 'all';
  return {
    fleetId,
    scope: fleetId === 'all' ? undefined : fleetId,
    name: options.find((o) => o.id === fleetId)?.label,
    many,
    choose: fleetFilterStore.getState().choose,
  };
}
