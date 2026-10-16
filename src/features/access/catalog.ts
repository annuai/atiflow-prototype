import { localized } from '@/i18n';

/**
 * THE catalog of what exists to be permitted: workspaces (the divisions of the product) and the features inside them. A permission is `<workspace>.<feature>`.
 * Everything else (the Users matrix, the sidebar, route guards, the workspace switcher, landing pages) reads this one file. A new feature = one entry here
 * (+ its route rule); a new workspace = one entry in WORKSPACES.
 */
export type WorkspaceId = 'configurator' | 'supervisor' | 'operator';
export type PermissionId = `${WorkspaceId}.${string}`;

export interface Feature {
  /** Permission id, `<workspace>.<feature>`. */
  id: PermissionId;
  label: string;
  /** Where the user lands when this is their first allowed feature (omit when the feature has no page of its own, e.g. fleets are opened from the sidebar list). */
  landing?: string;
  /** Routes this permission opens. A rule is a path prefix; a trailing `$` means exactly that path. */
  routes: string[];
}
export interface Workspace {
  id: WorkspaceId;
  /** Sidebar title (capitals) and the plain name used in the switcher and the permission matrix. */
  title: string;
  name: string;
  blurb: string;
  /** false = the workspace has no pages yet: it can be assigned and shows in the matrix, but cannot be entered. */
  built: boolean;
  features: Feature[];
  /** Pages that every user of this workspace may open (notifications). */
  shared: string[];
}

type RawFeature = Omit<Feature, 'label'>;
type RawWorkspace = Omit<Workspace, 'title' | 'name' | 'blurb' | 'features'> & { features: RawFeature[] };

const text = localized('nav');
type FeatureKey = keyof typeof text.features;

/** The names (title, name, blurb, feature labels) are NOT in this file: they come from the language in use (the nav catalogs in src/i18n/locales) every time they are read. */
const RAW: RawWorkspace[] = [
  {
    id: 'configurator',
    built: true,
    shared: ['/configurator/notifications', '/configurator/search'],
    features: [
      { id: 'configurator.robots', landing: '/configurator/robots', routes: ['/configurator/robots'] },
      { id: 'configurator.maps', landing: '/configurator/maps', routes: ['/configurator/maps'] },
      {
        id: 'configurator.hardware',
        landing: '/configurator/hardware',
        routes: ['/configurator/hardware'],
      },
      {
        id: 'configurator.master-data',
        landing: '/configurator/master-data',
        routes: ['/configurator/master-data'],
      },
      {
        id: 'configurator.workflows',
        landing: '/configurator',
        routes: ['/configurator$', '/configurator/workflows'],
      },
      { id: 'configurator.fleets', routes: ['/configurator/fleets'] },
      { id: 'configurator.settings', routes: ['/configurator/settings'] },
    ],
  },
  {
    id: 'supervisor',
    built: true,
    shared: ['/supervisor/notifications', '/supervisor/search'],
    features: [
      {
        id: 'supervisor.dashboard',
        landing: '/supervisor/dashboard',
        routes: ['/supervisor/dashboard'],
      },
      { id: 'supervisor.reports', landing: '/supervisor/reports', routes: ['/supervisor/reports'] },
      {
        id: 'supervisor.live-floor',
        landing: '/supervisor/livefloor',
        routes: ['/supervisor/livefloor'],
      },
      {
        id: 'supervisor.action-center',
        landing: '/supervisor/action-center',
        routes: ['/supervisor/action-center'],
      },
      { id: 'supervisor.settings', routes: ['/supervisor/settings'] },
    ],
  },
  {
    id: 'operator',
    built: true,
    shared: ['/operator/notifications', '/operator/search'],
    features: [
      { id: 'operator.approve', landing: '/operator/approve', routes: ['/operator/approve'] },
      {
        id: 'operator.book-trip',
        landing: '/operator/book',
        routes: ['/operator/book', '/operator/request'], // the old Request address still opens (it redirects here)
      },
      { id: 'operator.history', landing: '/operator/history', routes: ['/operator/history'] },
      {
        id: 'operator.action-center',
        landing: '/operator/action-center',
        routes: ['/operator/action-center'],
      },
      { id: 'operator.settings', routes: ['/operator/settings'] },
    ],
  },
];

export const WORKSPACES: Workspace[] = RAW.map((w) => {
  const features = w.features.map((f) =>
    Object.defineProperty({ ...f }, 'label', { enumerable: true, get: () => text.features[f.id as FeatureKey] }),
  ) as Feature[];
  return Object.defineProperties(
    { ...w, features },
    {
      title: { enumerable: true, get: () => text.workspaces[w.id].title },
      name: { enumerable: true, get: () => text.workspaces[w.id].name },
      blurb: { enumerable: true, get: () => text.workspaces[w.id].blurb },
    },
  ) as Workspace;
});

export const ALL_PERMISSIONS: PermissionId[] = WORKSPACES.flatMap((w) => w.features.map((f) => f.id));
export const workspaceById = (id: WorkspaceId): Workspace => WORKSPACES.find((w) => w.id === id)!;
export const featureById = (id: PermissionId): Feature | undefined =>
  WORKSPACES.flatMap((w) => w.features).find((f) => f.id === id);
export const workspaceOfPermission = (id: PermissionId): WorkspaceId => id.split('.')[0] as WorkspaceId;

/** Pages that exist for a signed-in user outside any permission (the Users page has its own capability: see policy.ts). */
export const USERS_PATH = '/configurator/users';
