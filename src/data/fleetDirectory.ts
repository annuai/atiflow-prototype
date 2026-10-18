import { useStore } from 'zustand';
import { datasetStore } from './dataset';
import type { FleetId, FleetRecord } from './fleets';

/** Read access to the fleet list of the shared dataset. Components and stores use this, so they never depend on where the data comes from. */
export const fleetDirectory = {
  list: (): FleetRecord[] => datasetStore.getState().fleets,
  byId: (id: string) => fleetDirectory.list().find((f) => f.id === id),
  /** The fleet a Live Floor lane-map fleet id (`line-side`, `asrs`) stands for. */
  byLiveId: (liveId: string) => fleetDirectory.list().find((f) => (f.liveId ?? f.id) === liveId),
  /** The shared name for a lane-map fleet id; `fallback` when the id is not in the list. */
  nameForLive: (liveId: string, fallback: string) => fleetDirectory.byLiveId(liveId)?.name ?? fallback,
  /** A fleet's current name by its id (the id itself when the fleet is gone). */
  nameOf: (id: string) => fleetDirectory.byId(id)?.name ?? id,
  byName: (name: string) => fleetDirectory.list().find((f) => f.name.toLowerCase() === name.trim().toLowerCase()),
};

/** The fleets as a hook. */
export const useFleetDirectory = (): FleetRecord[] => useStore(datasetStore, (s) => s.fleets);

/** The current name of a fleet, by id: re-renders when the fleet is renamed. */
export const useFleetName = (id: string): string =>
  useStore(datasetStore, (s) => s.fleets.find((f) => f.id === id)?.name ?? id);
/** The fleets as dropdown options (dataset id + current name). Not the Live Floor's map ids: those are `useFleetOptions` in `features/auth`. */
export const useFleetChoices = (): { id: FleetId; label: string }[] => {
  const fleets = useFleetDirectory();
  return fleets.map((f) => ({ id: f.id, label: f.name }));
};
