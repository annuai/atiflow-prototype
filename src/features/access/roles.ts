import { localized } from '@/i18n';
import { workspaceById, type PermissionId, type WorkspaceId } from './catalog';

/**
 * Roles are PRESETS of permissions: a user has a role and may be customised on top (extra ticks / removed ticks, see policy.ts).
 * Someone who needs several modules (a configurator who also uses the supervisor pages) is NOT a special role: they are a configurator with those permissions ticked.
 */
export type RoleId = 'configurator' | 'supervisor' | 'operator';
export interface RoleDef {
  id: RoleId;
  label: string;
  blurb: string;
  /** The preset. */
  permissions: PermissionId[];
  /** The workspace a user of this role starts in. */
  workspace: WorkspaceId;
  /** First page of a user of this role (when they may open it). */
  home?: string;
  /** Configurators manage users: only they see the Users page. */
  manageUsers: boolean;
}
const ofWorkspace = (w: WorkspaceId) => workspaceById(w).features.map((f) => f.id);

type RawRole = Omit<RoleDef, 'label' | 'blurb'>;
const text = localized('nav');
/** Role names and descriptions come from the language in use (the nav catalogs in src/i18n/locales). */
const RAW_ROLES: RawRole[] = [
  {
    id: 'configurator',
    permissions: ofWorkspace('configurator'),
    workspace: 'configurator',
    home: '/configurator',
    manageUsers: true,
  },
  {
    id: 'supervisor',
    permissions: ofWorkspace('supervisor'),
    workspace: 'supervisor',
    home: '/supervisor/dashboard',
    manageUsers: false,
  },
  {
    id: 'operator',
    permissions: ofWorkspace('operator'),
    workspace: 'operator',
    home: '/operator/book',
    manageUsers: false,
  },
];
export const ROLES: RoleDef[] = RAW_ROLES.map(
  (r) =>
    Object.defineProperties(
      { ...r },
      {
        label: { enumerable: true, get: () => text.roles[r.id].label },
        blurb: { enumerable: true, get: () => text.roles[r.id].blurb },
      },
    ) as RoleDef,
);
export const roleById = (id: RoleId): RoleDef => ROLES.find((r) => r.id === id) ?? ROLES[1];
export const presetOf = (role: RoleId): PermissionId[] => roleById(role).permissions;
