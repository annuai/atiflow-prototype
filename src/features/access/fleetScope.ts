import type { RoleId } from './roles';

/**
 * Fleet scope (pure): which fleets a person sees. Supervisors and operators are given the fleets they work with and see nothing else, so they are not
 * burdened with the rest of the floor. Configurators build the fleets, so they always see all of them. A scoped person needs at least one fleet.
 * Fleets are stored by their stable id (a rename never breaks the list).
 */
export interface ScopeProfile {
  role: RoleId;
  fleets?: string[];
}

export const isFleetScoped = (role: RoleId): boolean => role !== 'configurator';
/** The fleet ids the person may see (only ids that still exist), or null = all of them. */
export function fleetScope(p: ScopeProfile, allIds: string[]): string[] | null {
  if (!isFleetScoped(p.role)) return null;
  return (p.fleets ?? []).filter((id) => allIds.includes(id));
}
/** The fleets a scoped role must be given when it is saved: one at least. '' = fine. */
export const fleetsError = (role: RoleId, fleets: string[]): string =>
  isFleetScoped(role) && fleets.length === 0 ? 'Select at least one fleet' : '';
/** A stable text for the scope, to notice when it changed. */
export const scopeKey = (p: ScopeProfile & { username?: string }, allIds: string[]): string =>
  `${p.username ?? ''}|${fleetScope(p, allIds)?.slice().sort().join(',') ?? '*'}`;
