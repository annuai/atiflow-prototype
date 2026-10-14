import { useMemo } from 'react';
import { fleetScope } from '@/features/access';
import { fleetDirectory } from '@/data/fleetDirectory';
import { useDataset } from '@/data/dataset';
import { useAuth } from '@/features/auth/authStore';
import type { Person } from './rules';

/** The signed-in person as the request rules see them: username, name and the fleet ids they work on (every fleet for someone who is not fleet-scoped). */
export function useOperator(): Person & { name: string } {
  const user = useAuth((s) => s.user)!; const all = useDataset((s) => s.fleets).map((f) => f.id).join('|');
  return useMemo(() => ({ username: user.username, name: user.name, fleets: fleetScope(user, all.split('|')) ?? all.split('|') }), [user, all]);
}
export const fleetIdOf = (name: string) => fleetDirectory.byName(name)?.id;
export const fleetLiveOf = (name: string) => { const f = fleetDirectory.byName(name); return f ? f.liveId ?? f.id : name; };
