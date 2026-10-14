import { can, fleetScope } from '@/features/access';
import { fleetDirectory } from '@/data/fleetDirectory';
import { useDataset } from '@/data/dataset';
import { toPublic, useUsers } from '@/features/auth/userDirectory';
import type { PublicUser, UserRecord } from '@/features/auth/types';

/** People who may request materials: anyone holding the Request permission whose fleets include the workflow's fleet (pure). */
export function requestUsers(users: UserRecord[], fleetId: string | undefined, allFleetIds: string[]): PublicUser[] {
  return users.map(toPublic).filter((u) => can(u, 'operator.request') && (!fleetId || (fleetScope(u, allFleetIds)?.includes(fleetId) ?? true)));
}
/** The people a workflow's Start step can name: the users who may request on the workflow's fleet. */
export function useRequestUsers(fleetName: string): PublicUser[] {
  const users = useUsers((s) => s.users); const all = useDataset((s) => s.fleets).map((f) => f.id);
  return requestUsers(users, fleetDirectory.byName(fleetName)?.id, all);
}
