/**
 * THE catalog of what exists to be permitted: workspaces (the divisions of the product) and the features inside them. A permission is `<workspace>.<feature>`.
 * Everything else (the Users matrix, the sidebar, route guards, the workspace switcher, landing pages) reads this one file. A new feature = one entry here
 * (+ its route rule); a new workspace = one entry in WORKSPACES.
 */
export type WorkspaceId = 'configurator' | 'supervisor' | 'operator';
export type PermissionId = `${WorkspaceId}.${string}`;

export interface Feature {
  /** Permission id, `<workspace>.<feature>`. */
  id: PermissionId; label: string;
  /** Where the user lands when this is their first allowed feature (omit when the feature has no page of its own, e.g. fleets are opened from the sidebar list). */
  landing?: string;
  /** Routes this permission opens. A rule is a path prefix; a trailing `$` means exactly that path. */
  routes: string[];
}
export interface Workspace {
  id: WorkspaceId;
  /** Sidebar title (capitals) and the plain name used in the switcher and the permission matrix. */
  title: string; name: string; blurb: string;
  /** false = the workspace has no pages yet: it can be assigned and shows in the matrix, but cannot be entered. */
  built: boolean;
  features: Feature[];
  /** Pages that every user of this workspace may open (notifications). */
  shared: string[];
}

export const WORKSPACES: Workspace[] = [
  { id: 'configurator', title: 'CONFIGURATOR', name: 'Configurator', blurb: 'Set up robots, maps, hardware, master data, workflows, fleets and settings', built: true, shared: ['/configurator/notifications'], features: [
    { id: 'configurator.robots', label: 'Robots', landing: '/configurator/robots', routes: ['/configurator/robots'] },
    { id: 'configurator.maps', label: 'Maps', landing: '/configurator/maps', routes: ['/configurator/maps'] },
    { id: 'configurator.hardware', label: 'Hardware', landing: '/configurator/hardware', routes: ['/configurator/hardware'] },
    { id: 'configurator.master-data', label: 'Master Data', landing: '/configurator/master-data', routes: ['/configurator/master-data'] },
    { id: 'configurator.workflows', label: 'Workflows', landing: '/configurator', routes: ['/configurator$', '/configurator/workflows'] },
    { id: 'configurator.fleets', label: 'Fleets', routes: ['/configurator/fleets'] },
    { id: 'configurator.settings', label: 'Settings', routes: ['/configurator/settings'] },
  ] },
  { id: 'supervisor', title: 'SUPERVISOR', name: 'Supervisor', blurb: 'Watch the floor and read how the fleet is doing', built: true, shared: ['/supervisor/notifications'], features: [
    { id: 'supervisor.dashboard', label: 'Dashboard', landing: '/supervisor/dashboard', routes: ['/supervisor/dashboard'] },
    { id: 'supervisor.reports', label: 'Reports', landing: '/supervisor/reports', routes: ['/supervisor/reports'] },
    { id: 'supervisor.live-floor', label: 'Live Floor', landing: '/supervisor/livefloor', routes: ['/supervisor/livefloor'] },
    { id: 'supervisor.action-center', label: 'Action Center', landing: '/supervisor/action-center', routes: ['/supervisor/action-center'] },
    { id: 'supervisor.settings', label: 'Settings', routes: ['/supervisor/settings'] },
  ] },
  { id: 'operator', title: 'OPERATOR', name: 'Operator', blurb: 'Request materials, book trips, approve requests and handle robot calls', built: true, shared: ['/operator/notifications'], features: [
    { id: 'operator.request', label: 'Request', landing: '/operator/request', routes: ['/operator/request'] },
    { id: 'operator.approve', label: 'Approve', landing: '/operator/approve', routes: ['/operator/approve'] },
    { id: 'operator.book-trip', label: 'Book trip', landing: '/operator/book', routes: ['/operator/book'] },
    { id: 'operator.history', label: 'History', landing: '/operator/history', routes: ['/operator/history'] },
    { id: 'operator.action-center', label: 'Action Center', landing: '/operator/action-center', routes: ['/operator/action-center'] },
  ] },
];

export const ALL_PERMISSIONS: PermissionId[] = WORKSPACES.flatMap((w) => w.features.map((f) => f.id));
export const workspaceById = (id: WorkspaceId): Workspace => WORKSPACES.find((w) => w.id === id)!;
export const featureById = (id: PermissionId): Feature | undefined => WORKSPACES.flatMap((w) => w.features).find((f) => f.id === id);
export const workspaceOfPermission = (id: PermissionId): WorkspaceId => id.split('.')[0] as WorkspaceId;

/** Pages that exist for a signed-in user outside any permission (the Users page has its own capability: see policy.ts). */
export const USERS_PATH = '/configurator/users';
