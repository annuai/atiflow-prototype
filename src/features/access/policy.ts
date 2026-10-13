import { WORKSPACES, USERS_PATH, workspaceById, type PermissionId, type Workspace, type WorkspaceId } from './catalog';
import { presetOf, roleById, type RoleId } from './roles';

/**
 * The rules, all pure: what a user may do follows from their ROLE (a preset) plus their own changes (`custom`: ticks added, ticks removed).
 * Nothing here knows about React, routes objects or storage, so the sidebar, the guards, the switcher and the Users page all ask the same functions.
 */
export interface Custom { add: PermissionId[]; remove: PermissionId[] }
export interface AccessProfile { role: RoleId; custom?: Custom }

const norm = (p: string) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);
const matches = (path: string, rule: string) => (rule.endsWith('$') ? norm(path) === rule.slice(0, -1) : (norm(path) === rule || norm(path).startsWith(rule + '/')));

/** Every permission the user holds: the role's preset plus what was ticked for this user, minus what was unticked. */
export function effective(p: AccessProfile): Set<PermissionId> {
  const set = new Set(presetOf(p.role)); p.custom?.remove.forEach((x) => set.delete(x)); p.custom?.add.forEach((x) => set.add(x)); return set;
}
export const can = (p: AccessProfile, perm: PermissionId) => effective(p).has(perm);
export const isCustomised = (p: AccessProfile) => !!p.custom && (p.custom.add.length > 0 || p.custom.remove.length > 0);
/** Configurators manage users (and are the only ones who see the Users page). */
export const canManageUsers = (p: AccessProfile) => roleById(p.role).manageUsers;

/** The workspaces the user holds at least one permission in, in catalog order. */
export function workspacesOf(p: AccessProfile): Workspace[] {
  const held = effective(p); return WORKSPACES.filter((w) => w.features.some((f) => held.has(f.id)));
}
export const hasWorkspace = (p: AccessProfile, id: WorkspaceId) => workspacesOf(p).some((w) => w.id === id);
/** The workspaces the user can actually enter (they have pages). */
export const enterableWorkspaces = (p: AccessProfile) => workspacesOf(p).filter((w) => w.built);

export const workspaceOfPath = (path: string): WorkspaceId | null => WORKSPACES.find((w) => path === `/${w.id}` || path.startsWith(`/${w.id}/`))?.id ?? null;

/** May the user open this page? Feature routes need their permission, the Users page needs the manage-users capability, notifications need any permission of that workspace. */
export function canOpen(p: AccessProfile, path: string): boolean {
  const held = effective(p);
  for (const w of WORKSPACES) for (const f of w.features) if (held.has(f.id) && f.routes.some((r) => matches(path, r))) return true;
  if (matches(path, USERS_PATH)) return canManageUsers(p);
  const w = WORKSPACES.find((x) => x.shared.some((s) => matches(path, s)));
  return !!w && w.built && hasWorkspace(p, w.id);
}

/** First page the user can open inside a workspace (the feature order of the catalog), else that workspace's shared page. */
export function workspaceHome(p: AccessProfile, id: WorkspaceId): string | null {
  const w = workspaceById(id); const held = effective(p); const f = w.features.find((x) => held.has(x.id) && x.landing);
  return f?.landing ?? (w.built && hasWorkspace(p, id) ? w.shared[0] ?? null : null);
}
/** Where to send a signed-in user: the page they last used when they may still open it, else the first page of their own workspace, else any other workspace, else the no-access page. */
export function landingPath(p: AccessProfile, remembered?: string | null): string {
  if (remembered && canOpen(p, remembered)) return remembered;
  const home = roleById(p.role).home; if (home && canOpen(p, home)) return home;
  const own = roleById(p.role).workspace; const order = [own, ...WORKSPACES.map((w) => w.id).filter((x) => x !== own)];
  for (const id of order) { const home = workspaceHome(p, id); if (home) return home; }
  return '/no-access';
}

/** Tick or untick one permission; the result stores only the difference from the role's preset (so a later change of the preset still flows through). */
export function setPermission(p: AccessProfile, perm: PermissionId, on: boolean): AccessProfile {
  const preset = new Set(presetOf(p.role)); const add = new Set(p.custom?.add ?? []), remove = new Set(p.custom?.remove ?? []);
  add.delete(perm); remove.delete(perm); if (on && !preset.has(perm)) add.add(perm); if (!on && preset.has(perm)) remove.add(perm);
  return { role: p.role, custom: { add: [...add], remove: [...remove] } };
}
/** Tick or untick every feature of a workspace. */
export function setWorkspace(p: AccessProfile, id: WorkspaceId, on: boolean): AccessProfile {
  return workspaceById(id).features.reduce((acc, f) => setPermission(acc, f.id, on), p);
}
/** A new role starts from its preset again (custom ticks belong to the old role). */
export const withRole = (role: RoleId): AccessProfile => ({ role });
/** Every role can be given to anyone by a user manager. */
export const assignableRoles = (): RoleId[] => ['configurator', 'supervisor', 'line-supervisor', 'operator'];
/** May the actor delete this user? Anyone who manages users can, except themselves (everything else, including their own role and permissions, they may change). */
export const canDeleteUser = (actor: AccessProfile & { username: string }, target: { username: string }): boolean => canManageUsers(actor) && actor.username !== target.username;
export const permissionsOfWorkspace = (p: AccessProfile, id: WorkspaceId) => workspaceById(id).features.filter((f) => effective(p).has(f.id));
