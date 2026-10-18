import { useMemo } from 'react';
import { fleetScope } from '@/features/access';
import { fleetDirectory } from '@/data/fleetDirectory';
import type { FleetId } from '@/data/fleets';
import { useDataset } from '@/data/dataset';
import { useAuth } from '@/features/auth';

/** The signed-in person as the request rules see them: username, name and the fleet ids they work on (every fleet for someone who is not fleet-scoped). */
export function useOperator(): { username: string; name: string; fleets: string[] } {
  const user = useAuth((s) => s.user)!;
  const all = useDataset((s) => s.fleets)
    .map((f) => f.id)
    .join('|');
  return useMemo(
    () => ({ username: user.username, name: user.name, fleets: fleetScope(user, all.split('|')) ?? all.split('|') }),
    [user, all],
  );
}
/** The id the Live Floor's lane map and the fleet's orders use for a fleet (its map id when it has one). */
export const fleetLiveOf = (fleet: FleetId): string => {
  const f = fleetDirectory.byId(fleet);
  return f ? (f.liveId ?? f.id) : fleet;
};
