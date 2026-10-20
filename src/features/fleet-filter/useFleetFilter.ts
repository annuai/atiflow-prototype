import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from 'zustand';
import { useFleetOptions } from '@/features/auth';
import { fleetFilterStore } from './store';

/**
 * The fleet filter as the pages read it. `fleetId` is 'all' or one fleet the person can see (a choice that is no longer valid, or a person with one fleet only, is "all": nothing to
 * choose); `scope` is that fleet's id, or undefined for all of them: what a data source takes.
 */
export function useFleetFilter() {
  const stored = useStore(fleetFilterStore, (s) => s.fleetId);
  const [params, setParams] = useSearchParams();
  const chosen = params.get('fleet') ?? stored; // a link names its fleet (`?fleet=line-side`); without one the device's own choice applies
  const options = useFleetOptions();
  const choose = useCallback(
    (id: string) => {
      fleetFilterStore.getState().choose(id);
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          if (id === 'all') next.delete('fleet');
          else next.set('fleet', id);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  const many = options.length > 1;
  const fleetId = many && options.some((o) => o.id === chosen) ? chosen : 'all';
  return {
    fleetId,
    scope: fleetId === 'all' ? undefined : fleetId,
    name: options.find((o) => o.id === fleetId)?.label,
    many,
    choose,
  };
}
