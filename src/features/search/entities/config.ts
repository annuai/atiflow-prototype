import { Cube01, Flag01, Users01, GitBranch01, Map01, Settings01, Server01, Hash02 } from '@untitledui/icons';
import { fleetDirectory } from '@/data/fleetDirectory';
import { datasetStore } from '@/data/dataset';
import { USERS_PATH } from '@/features/access';
import { toPublic, userDirectory, type PublicUser } from '@/features/auth';
import { KINDS, deviceStore, nameOf, type Device } from '@/features/devices';
import { fleetPath } from '@/features/fleets';
import { mapsStore, type FleetMap } from '@/features/maps';
import { masterDataStore, type Material } from '@/features/master-data';
import type { RequestableItem } from '@/features/requests';
import { METRICS, METRIC_ORDER } from '@/features/reports';
import { CONNECTIONS } from '@/features/settings';
import { isKept, wfStore, type Workflow as Wf } from '@/features/workflow-builder';
import { copy } from '../copy';
import type { SearchEntity } from '../types';
import { focusUrl, meta } from './helpers';
import { operatorItems } from './operatorData';
import type { FleetId } from '@/data/fleets';

type WorkflowRow = { w: Wf; operator?: RequestableItem };
/** Workflows: configurators search all kept ones and open them in the editor; an operator only finds the ones they may order (the Book trip rules). */
export const workflowEntity: SearchEntity<WorkflowRow> = {
  type: 'workflow',
  label: () => copy.types.workflow,
  icon: GitBranch01,
  permission: (ctx) => ctx.can('configurator.workflows') || ctx.can('operator.book-trip'),
  load: (ctx) => {
    if (ctx.can('configurator.workflows'))
      return Object.values(wfStore.getState().workflows)
        .filter(isKept)
        .map((w) => ({ w }));
    const { materials, trips } = operatorItems(ctx);
    const seen = new Set<string>();
    return [...trips, ...materials]
      .filter((i) => !seen.has(i.workflowId) && !!seen.add(i.workflowId))
      .flatMap((i) => {
        const w = wfStore.getState().workflows[i.workflowId];
        return w ? [{ w, operator: i }] : [];
      });
  },
  fields: [
    { get: (x) => x.w.name, weight: 4 },
    { get: (x) => (x.w.fleet ? fleetDirectory.nameOf(x.w.fleet) : ''), weight: 1 },
    { get: (x) => x.w.nodes.map((n) => Object.values(n.f).join(' ')).join(' '), weight: 0.5 },
  ],
  id: (x) => x.w.id,
  home: ['configurator', 'operator'],
  toResult: (x) => ({
    title: x.w.name,
    subtitle: x.w.fleet ? fleetDirectory.nameOf(x.w.fleet) : undefined,
    url: x.operator
      ? '/operator/book' + (x.operator.kind === 'route' ? '?tab=trips' : '')
      : `/configurator/workflows/${x.w.id}`,
    facets: {
      status: x.w.published ? 'published' : 'draft',
      fleet: x.w.fleet ? fleetDirectory.nameOf(x.w.fleet) : undefined,
    },
    metadata: [
      ...meta(copy.meta.status, x.w.published ? 'published' : 'draft', x.w.published ? 'success' : 'gray'),
      ...meta(copy.meta.steps, x.w.nodes.length),
    ],
  }),
  actions: (x) =>
    x.operator
      ? [
          {
            id: 'order',
            label: x.operator.kind === 'route' ? copy.actions.book : copy.actions.order,
            kind: 'navigate',
            url: '/operator/book' + (x.operator.kind === 'route' ? '?tab=trips' : ''),
            primary: true,
          },
        ]
      : [
          {
            id: 'editor',
            label: copy.actions.editor,
            kind: 'navigate',
            url: `/configurator/workflows/${x.w.id}`,
            primary: true,
          },
        ],
};

type MaterialRow = { code: string; name: string; group: string; fleets: FleetId[] };
/**
 * The rows of Master Data as search rows. The same array is returned while Master Data is unchanged: the search index is rebuilt whenever it gets a different list,
 * and with tens of thousands of materials that must happen once, not on every search.
 */
let masterMemo: { materials: Material[]; groups: unknown; rows: MaterialRow[] } | null = null;
function masterRows(materials: Material[], groups: { id: string; name: string }[]): MaterialRow[] {
  if (masterMemo && masterMemo.materials === materials && masterMemo.groups === groups) return masterMemo.rows;
  const names = new Map(groups.map((g) => [g.id, g.name]));
  const rows = materials.map((m) => ({
    code: m.code,
    name: m.name,
    group: names.get(m.group) ?? '',
    fleets: m.fleets,
  }));
  masterMemo = { materials, groups, rows };
  return rows;
}
/** Materials: configurators search Master Data; operators only what they may order. */
export const materialEntity: SearchEntity<MaterialRow> = {
  type: 'material',
  label: () => copy.types.material,
  icon: Cube01,
  permission: (ctx) => ctx.can('configurator.master-data') || ctx.can('operator.book-trip'),
  load: (ctx) => {
    const md = masterDataStore.getState();
    if (ctx.can('configurator.master-data')) return masterRows(md.materials, md.groups);
    const seen = new Set<string>();
    return operatorItems(ctx)
      .materials.filter((i) => !seen.has(i.code) && !!seen.add(i.code))
      .map((i) => ({ code: i.code, name: i.name, group: i.group, fleets: [i.fleet] }));
  },
  fields: [
    { get: (m) => m.code, weight: 4 },
    { get: (m) => m.name, weight: 3 },
    { get: (m) => m.group, weight: 1 },
  ],
  id: (m) => m.code,
  home: ['configurator', 'operator'],
  toResult: (m, ctx) => ({
    title: m.name,
    subtitle: m.code,
    url: ctx.can('configurator.master-data')
      ? `/configurator/master-data/materials?code=${encodeURIComponent(m.code)}`
      : `/operator/book?add=${encodeURIComponent(m.code)}`,
    metadata: [
      ...meta(copy.meta.group, m.group),
      ...meta(copy.meta.fleets, m.fleets.map((f) => fleetDirectory.nameOf(f)).join(', ')),
    ],
  }),
  actions: (m, ctx) =>
    ctx.can('configurator.master-data')
      ? [
          {
            id: 'open',
            label: copy.actions.open,
            kind: 'navigate',
            url: `/configurator/master-data/materials?code=${encodeURIComponent(m.code)}`,
            primary: true,
          },
        ]
      : [
          {
            id: 'order',
            label: copy.actions.order,
            kind: 'navigate',
            url: `/operator/book?add=${encodeURIComponent(m.code)}`,
            primary: true,
          },
        ],
};

interface FleetRow {
  id: FleetId;
  name: string;
  liveId?: string;
}
export const fleetEntity: SearchEntity<FleetRow> = {
  type: 'fleet',
  label: () => copy.types.fleet,
  icon: Flag01,
  permission: (ctx) => ctx.can('configurator.fleets') || ctx.can('supervisor.live-floor'),
  load: (ctx) => datasetStore.getState().fleets.filter((f) => !ctx.liveFleets || ctx.liveFleets.has(f.liveId ?? f.id)),
  fields: [{ get: (f) => f.name, weight: 4 }],
  id: (f) => f.id,
  home: ['configurator', 'supervisor'],
  toResult: (f, ctx) => ({
    title: f.name,
    url: ctx.can('configurator.fleets') ? fleetPath(f.id) : focusUrl('fleet', f.liveId ?? f.id),
    metadata: [],
  }),
  actions: (f, ctx) => [
    ctx.can('configurator.fleets')
      ? { id: 'open', label: copy.actions.openFleet, kind: 'navigate', url: fleetPath(f.id), primary: true }
      : {
          id: 'show',
          label: copy.actions.showOnMap,
          kind: 'navigate',
          url: focusUrl('fleet', f.liveId ?? f.id),
          primary: true,
        },
  ],
};

type DeviceRow = { kind: 'robot' | 'hardware'; d: Device };
/** The registered robots and hardware (the configurator's lists). */
export const deviceEntity: SearchEntity<DeviceRow> = {
  type: 'device',
  label: () => copy.types.device,
  icon: Hash02,
  permission: (ctx) => ctx.can('configurator.robots') || ctx.can('configurator.hardware'),
  load: (ctx) => {
    const s = deviceStore.getState();
    return [
      ...(ctx.can('configurator.robots') ? s.robot.map((d) => ({ kind: 'robot' as const, d })) : []),
      ...(ctx.can('configurator.hardware') ? s.hardware.map((d) => ({ kind: 'hardware' as const, d })) : []),
    ];
  },
  fields: [
    { get: (x) => nameOf(x.d), weight: 4 },
    { get: (x) => KINDS[x.kind].typeOf(x.d), weight: 1.5 },
    { get: (x) => fleetDirectory.nameOf(String(x.d.values.fleet ?? '')), weight: 1 },
  ],
  id: (x) => nameOf(x.d),
  home: ['configurator'],
  toResult: (x) => ({
    title: nameOf(x.d),
    subtitle: KINDS[x.kind].typeOf(x.d),
    url: `/configurator/${KINDS[x.kind].route}/${encodeURIComponent(nameOf(x.d))}`,
    facets: {
      status: x.d.status,
      fleet: x.d.values.fleet ? fleetDirectory.nameOf(String(x.d.values.fleet)) : undefined,
    },
    metadata: [
      ...meta(copy.meta.kind, KINDS[x.kind].singular),
      ...meta(copy.meta.fleet, x.d.values.fleet ? fleetDirectory.nameOf(String(x.d.values.fleet)) : ''),
      ...meta(copy.meta.status, x.d.status),
    ],
  }),
  actions: (x) => [
    {
      id: 'open',
      label: copy.actions.open,
      kind: 'navigate',
      url: `/configurator/${KINDS[x.kind].route}/${encodeURIComponent(nameOf(x.d))}`,
      primary: true,
    },
  ],
};

export const mapEntity: SearchEntity<FleetMap> = {
  type: 'map',
  label: () => copy.types.map,
  icon: Map01,
  permission: (ctx) => ctx.can('configurator.maps'),
  load: () => mapsStore.getState().maps,
  fields: [
    { get: (m) => m.name, weight: 4 },
    { get: (m) => m.tag, weight: 1 },
  ],
  id: (m) => m.id,
  home: ['configurator'],
  toResult: (m) => ({
    title: m.name,
    subtitle: `v${m.version}`,
    url: `/configurator/maps/${m.id}`,
    at: m.updatedAt,
    metadata: meta(copy.meta.version, `v${m.version}`),
  }),
  actions: (m) => [
    { id: 'open', label: copy.actions.openMap, kind: 'navigate', url: `/configurator/maps/${m.id}`, primary: true },
  ],
};

export const userEntity: SearchEntity<PublicUser> = {
  type: 'user',
  label: () => copy.types.user,
  icon: Users01,
  permission: (ctx) => ctx.canOpen(USERS_PATH),
  load: () => userDirectory.getState().users.map(toPublic),
  fields: [
    { get: (u) => u.name, weight: 4 },
    { get: (u) => u.username, weight: 3 },
    { get: (u) => `${u.email} ${u.title}`, weight: 1 },
  ],
  id: (u) => u.username,
  home: ['configurator'],
  toResult: (u) => ({
    title: u.name,
    subtitle: u.username,
    url: `${USERS_PATH}/${u.username}`,
    metadata: [...meta(copy.meta.role, u.role), ...meta(copy.meta.email, u.email)],
  }),
  actions: (u) => [
    { id: 'open', label: copy.actions.open, kind: 'navigate', url: `${USERS_PATH}/${u.username}`, primary: true },
  ],
};

export const integrationEntity: SearchEntity<(typeof CONNECTIONS)[number]> = {
  type: 'integration',
  label: () => copy.types.integration,
  icon: Server01,
  permission: (ctx) => ctx.can('configurator.settings'),
  load: () => CONNECTIONS,
  fields: [{ get: (c) => c.name, weight: 4 }],
  id: (c) => c.id,
  home: ['configurator'],
  toResult: (c) => ({ title: c.name, url: '/configurator/settings/connections', metadata: [] }),
  actions: () => [
    {
      id: 'open',
      label: copy.actions.open,
      kind: 'navigate',
      url: '/configurator/settings/connections',
      primary: true,
    },
  ],
};

export const metricEntity: SearchEntity<(typeof METRICS)[keyof typeof METRICS]> = {
  type: 'metric',
  label: () => copy.types.metric,
  icon: Hash02,
  permission: (ctx) => ctx.can('supervisor.reports'),
  load: () => METRIC_ORDER.map((id) => METRICS[id]),
  fields: [
    { get: (m) => `${m.label} ${m.short}`, weight: 4 },
    { get: (m) => m.definition, weight: 1 },
  ],
  id: (m) => m.id,
  home: ['supervisor'],
  toResult: (m) => ({ title: m.label, subtitle: m.unit, url: '/supervisor/reports', metadata: [] }),
  actions: () => [
    { id: 'open', label: copy.actions.open, kind: 'navigate', url: '/supervisor/reports', primary: true },
  ],
};
export const SettingsIcon = Settings01;
