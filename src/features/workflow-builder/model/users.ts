import { useMemo } from 'react';
import { can } from '@/features/access';
import { useDataset } from '@/data/dataset';
import { fleetScope } from '@/features/access/fleetScope';
import type { UserRecord } from '@/features/auth/types';
import { toPublic, userDirectory, useUsers } from '@/features/auth/userDirectory';
import { datasetStore } from '@/data/dataset';
import type { WfNode, Workflows } from './types';

export type UserPermission = 'operator.request' | 'operator.approve';
/**
 * The people a workflow's Start step (who may request) or Tablet Confirm step (who approves) can name (pure): users holding that permission whose fleets include the workflow's fleet
 * (a user who is not fleet-scoped counts for every fleet). `fleetId` undefined = no fleet chosen yet: nobody.
 */
export function eligibleUsers(users: UserRecord[], fleetId: string | undefined, permission: UserPermission, allFleetIds: string[]): { id: string; label: string }[] {
  if (!fleetId) return [];
  return users.map(toPublic).filter((u) => can(u, permission) && (fleetScope(u, allFleetIds) ?? allFleetIds).includes(fleetId)).map((u) => ({ id: u.username, label: `${u.name} (${u.username})` }));
}
/** For components: the people that can be picked, following the user list and the fleets. */
export function useEligibleUsers(fleetName: string | null, permission: UserPermission): { id: string; label: string }[] {
  const users = useUsers((s) => s.users); const fleets = useDataset((s) => s.fleets);
  return useMemo(() => eligibleUsers(users, fleets.find((f) => f.name === fleetName)?.id, permission, fleets.map((f) => f.id)), [users, fleets, fleetName, permission]);
}

/**
 * Workflows saved before requests named users have empty user lists. So they keep working, a Tablet workflow's empty Start list is filled with the people who may request on its fleet and an
 * empty Tablet Confirm list with the people who may approve there. Lists that already have users are left alone.
 */
export function prefillUsers(workflows: Workflows, users: UserRecord[] = userDirectory.getState().users, fleets = datasetStore.getState().fleets): Workflows {
  const ids = fleets.map((f) => f.id); const out: Workflows = {};
  for (const [id, w] of Object.entries(workflows)) {
    const fleetId = fleets.find((f) => f.name === w.fleet)?.id; const req = eligibleUsers(users, fleetId, 'operator.request', ids).map((u) => u.id); const app = eligibleUsers(users, fleetId, 'operator.approve', ids).map((u) => u.id);
    const empty = (n: WfNode) => !Array.isArray(n.f.users) || n.f.users.length === 0;
    const fix = (list: WfNode[]): WfNode[] => list.map((n) => {
      const base = n.t === 'start' && n.f.request === 'Tablet' && empty(n) ? { ...n, f: { ...n.f, users: req } } : n.t === 'confirm' && n.f.op === 'Tablet' && empty(n) ? { ...n, f: { ...n.f, users: app } } : n;
      return base.br ? { ...base, br: { t: fix(base.br.t), o: fix(base.br.o) } } : base;
    });
    out[id] = { ...w, nodes: fix(w.nodes) };
  }
  return out;
}
