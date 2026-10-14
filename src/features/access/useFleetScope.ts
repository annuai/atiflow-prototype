import { useMemo } from 'react';
import { useStore } from 'zustand';
import { datasetStore } from '@/data/dataset';
import type { FleetRecord } from '@/data/fleets';
import { authStore, useAuth } from '@/features/auth/authStore';
import { fleetScope } from './fleetScope';

/** The fleets the signed-in user may see (everything for a configurator). Pages, sidebars, dropdowns and the live feed all read this one rule. */
export const visibleFleets = (): FleetRecord[] => {
  const u = authStore.getState().user, all = datasetStore.getState().fleets; if (!u) return [];
  const ids = fleetScope(u, all.map((f) => f.id)); return ids ? all.filter((f) => ids.includes(f.id)) : all;
};
export function useVisibleFleets(): FleetRecord[] {
  const user = useAuth((s) => s.user), all = useStore(datasetStore, (s) => s.fleets);
  return useMemo(() => { if (!user) return []; const ids = fleetScope(user, all.map((f) => f.id)); return ids ? all.filter((f) => ids.includes(f.id)) : all; }, [user, all]);
}
/** The lane-map ids (`robot.fleetId` in telemetry) of the visible fleets, or null = all. */
export const visibleLiveIds = (): Set<string> | null => {
  const u = authStore.getState().user, all = datasetStore.getState().fleets; if (!u) return new Set();
  const ids = fleetScope(u, all.map((f) => f.id)); return ids ? new Set(all.filter((f) => ids.includes(f.id)).map((f) => f.liveId ?? f.id)) : null;
};
