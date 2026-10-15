import { useLocation, useNavigate } from 'react-router-dom';
import { BarChartSquare02, File05, LifeBuoy01 } from '@untitledui/icons';
import { store, useApp } from '@/core/store';
import { handle } from '@/ui/engineHandle';
import master from '@/ui/icons/master-data.svg';
import fleetI from '@/ui/icons/fleet.svg';
import bell from '@/ui/icons/bell.svg';
import gear from '@/ui/icons/settings.svg';
import { useUnreadCount } from '@/features/notifications';
import { useVisibleFleets, canNow, useAccess } from '@/features/auth';
import { useActionCenterRunning, useCalls } from '@/features/action-center';
import type { NavModel, SearchHit } from '@/shell/types';

import { ACTION_CENTER_PATH, DASHBOARD_PATH, LIVE_FLOOR_PATH, REPORTS_PATH, SUPERVISOR_SETTINGS_PATH } from './paths';
import { localized } from '@/i18n';
import { copy as names2 } from '@/ui/copy';

const names = localized('nav');
export { ACTION_CENTER_PATH, DASHBOARD_PATH, LIVE_FLOOR_PATH, REPORTS_PATH, SUPERVISOR_SETTINGS_PATH };

/** Sidebar content of the supervisor area: Dashboard and Live Floor are pages (the URL decides which one is highlighted); the fleet items filter the Live Floor. */
export function useLiveNav(): NavModel {
  const fleets = useVisibleFleets().map((f) => ({ id: f.liveId ?? f.id, name: f.name })),
    navSel = useApp((s) => s.navSel);
  const navigate = useNavigate();
  const path = useLocation().pathname;
  const onLive = path === LIVE_FLOOR_PATH;
  const st = store.getState();
  const unread = useUnreadCount();
  const pick = (sel: string, fleet: string) => () => {
    st.setNav(sel);
    st.setFleet(fleet);
    if (!onLive) navigate(LIVE_FLOOR_PATH);
  };
  useActionCenterRunning();
  const openCalls = useCalls().open; // the badge counts calls nobody has taken yet
  const { can } = useAccess(); // the sidebar only offers what the user may open
  const live = can('supervisor.live-floor'),
    dash = can('supervisor.dashboard');
  const groups = [
    {
      id: 'ops',
      label: names.groups.operations,
      items: [
        dash && {
          id: 'dashboard',
          label: names.features['supervisor.dashboard'],
          icon: BarChartSquare02,
          active: path === DASHBOARD_PATH,
          onSelect: () => navigate(DASHBOARD_PATH),
        },
        can('supervisor.reports') && {
          id: 'reports',
          label: names.features['supervisor.reports'],
          icon: File05,
          active: path === REPORTS_PATH,
          onSelect: () => navigate(REPORTS_PATH),
        },
        can('supervisor.action-center') && {
          id: 'action-center',
          label: names.features['supervisor.action-center'],
          icon: LifeBuoy01,
          badge: openCalls || undefined,
          active: path === ACTION_CENTER_PATH,
          onSelect: () => navigate(ACTION_CENTER_PATH),
        },
        live && {
          id: 'live',
          label: names.features['supervisor.live-floor'],
          icon: master,
          active: onLive && navSel === 'live',
          onSelect: pick('live', 'all'),
        },
      ],
    },
    ...(live && fleets.length > 1
      ? [
          {
            id: 'fleets',
            label: names.groups.fleets,
            items: [
              {
                id: 'all',
                label: names.items.allFleets,
                icon: fleetI,
                active: onLive && navSel === 'fleet:all',
                onSelect: pick('fleet:all', 'all'),
              },
              ...fleets.map((f) => ({
                id: f.id,
                label: f.name,
                icon: fleetI,
                active: onLive && navSel === 'fleet:' + f.id,
                onSelect: pick('fleet:' + f.id, f.id),
              })),
            ],
          },
        ]
      : []),
  ]
    .map((g) => ({ ...g, items: g.items.filter(Boolean) as NavModel['groups'][number]['items'] }))
    .filter((g) => g.items.length);
  return {
    groups,
    footerItems: [
      {
        id: 'notif',
        label: names.items.notifications,
        icon: bell,
        badge: unread || undefined,
        active: path === '/supervisor/notifications',
        onSelect: () => navigate('/supervisor/notifications'),
      },
      ...(can('supervisor.settings')
        ? [
            {
              id: 'settings',
              label: names.features['supervisor.settings'],
              icon: gear,
              active: path.startsWith(SUPERVISOR_SETTINGS_PATH),
              onSelect: () => navigate(SUPERVISOR_SETTINGS_PATH),
            },
          ]
        : []),
    ],
  };
}

export function liveHits(q: string): SearchHit[] {
  if (!canNow('supervisor.live-floor')) return []; // robots, trips, zones and stations are Live Floor content
  const ql = q.toLowerCase();
  const { robots, site, nav } = store.getState();
  return [
    ...Object.values(robots)
      .filter((r) => r.id.toLowerCase().includes(ql))
      .slice(0, 5)
      .map((r) => ({
        kind: names.hits.robot,
        title: r.id,
        sub: names2.states[r.state],
        ...(handle.engine
          ? { go: () => handle.engine?.focusRobot(r.id) }
          : { to: LIVE_FLOOR_PATH, state: { locate: r.id } }),
      })),
    ...Object.values(robots)
      .filter((r) => r.task && r.task.id.toLowerCase().includes(ql))
      .slice(0, 4)
      .map((r) => ({
        kind: names.hits.trip,
        title: r.task!.id,
        sub: `${r.id} → ${r.task!.to}`,
        ...(handle.engine
          ? { go: () => handle.engine?.focusRobot(r.id) }
          : { to: LIVE_FLOOR_PATH, state: { locate: r.id } }),
      })),
    ...(site?.zones
      .filter((z) => z.active && z.name.toLowerCase().includes(ql))
      .map((z) => ({
        kind: names.hits.zone,
        title: z.name,
        sub: names2.zoneKinds[z.kind as keyof typeof names2.zoneKinds] ?? z.kind,
        ...(handle.engine ? { go: () => handle.engine?.focusZone(z.id) } : { to: LIVE_FLOOR_PATH }),
      })) ?? []),
    ...(nav?.stations
      .filter((s) => (s.id + ' ' + s.name).toLowerCase().includes(ql))
      .slice(0, 6)
      .map((s) => ({
        kind: names.hits.station,
        title: `${s.id} · ${s.name}`,
        sub: names2.stationTypes[s.type],
        ...(handle.engine
          ? { go: () => store.getState().selectStation(s.id) }
          : { to: LIVE_FLOOR_PATH, state: { locate: s.id } }),
      })) ?? []),
  ];
}
