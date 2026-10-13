import { useLocation, useNavigate } from 'react-router-dom';
import { BarChartSquare02 } from '@untitledui/icons';
import { store, useApp } from '@/core/store';
import { handle } from '@/ui/engineHandle';
import master from '@/ui/icons/master-data.svg'; import fleetI from '@/ui/icons/fleet.svg'; 
import bell from '@/ui/icons/bell.svg'; import gear from '@/ui/icons/settings.svg';
import { notify } from '@/ui/toast';
import { useUnreadCount } from '@/features/notifications/NotificationsProvider';
import { useFleetDirectory } from '@/data/fleetDirectory';
import type { NavModel, SearchHit } from '@/shell/types';

const soon = (name: string) => () => notify.info(`${name} isn't part of this prototype`, 'The supervisor view covers the Live Floor.', 'soon');

export const DASHBOARD_PATH = '/supervisor/dashboard', DASHBOARD_NEW_PATH = '/supervisor/dashboard-new', LIVE_FLOOR_PATH = '/supervisor/livefloor';

/** Sidebar content of the supervisor area: Dashboard and Live Floor are pages (the URL decides which one is highlighted); the fleet items filter the Live Floor. */
export function useLiveNav(): NavModel {
  const fleets = useFleetDirectory().map((f) => ({ id: f.liveId ?? f.id, name: f.name })), navSel = useApp((s) => s.navSel), events = useApp((s) => s.events);
  const navigate = useNavigate(); const path = useLocation().pathname; const onLive = path === LIVE_FLOOR_PATH;
  const st = store.getState(); const unread = useUnreadCount();
  const pick = (sel: string, fleet: string) => () => { st.setNav(sel); st.setFleet(fleet); if (!onLive) navigate(LIVE_FLOOR_PATH); };
  return {
    groups: [
      { id: 'ops', label: 'Operations', items: [
        { id: 'dashboard', label: 'Dashboard', icon: BarChartSquare02, active: path === DASHBOARD_PATH, onSelect: () => navigate(DASHBOARD_PATH) },
        { id: 'dashboard-new', label: 'Dashboard (new)', icon: BarChartSquare02, active: path === DASHBOARD_NEW_PATH, onSelect: () => navigate(DASHBOARD_NEW_PATH) },
        { id: 'live', label: 'Live Floor', icon: master, active: onLive && navSel === 'live', onSelect: pick('live', 'all') },
      ] },
      { id: 'fleets', label: 'Fleets', items: [
        { id: 'all', label: 'All fleets', icon: fleetI, active: onLive && navSel === 'fleet:all', onSelect: pick('fleet:all', 'all') },
        ...fleets.map((f) => ({ id: f.id, label: f.name, icon: fleetI, active: onLive && navSel === 'fleet:' + f.id, onSelect: pick('fleet:' + f.id, f.id) })),
      ] },
    ],
    footerItems: [{ id: 'notif', label: 'Notifications', icon: bell, badge: unread || undefined, active: path === '/supervisor/notifications', onSelect: () => navigate('/supervisor/notifications') }, { id: 'settings', label: 'Settings', icon: gear, onSelect: soon('Settings') }],
  };
}

export function liveHits(q: string): SearchHit[] {
  const ql = q.toLowerCase(); const { robots, site, nav } = store.getState();
  return [
    ...Object.values(robots).filter((r) => r.id.toLowerCase().includes(ql)).slice(0, 5).map((r) => ({ kind: 'Robot', title: r.id, sub: r.state, ...(handle.engine ? { go: () => handle.engine?.focusRobot(r.id) } : { to: LIVE_FLOOR_PATH, state: { locate: r.id } }) })),
    ...Object.values(robots).filter((r) => r.task && r.task.id.toLowerCase().includes(ql)).slice(0, 4).map((r) => ({ kind: 'Trip', title: r.task!.id, sub: `${r.id} → ${r.task!.to}`, ...(handle.engine ? { go: () => handle.engine?.focusRobot(r.id) } : { to: LIVE_FLOOR_PATH, state: { locate: r.id } }) })),
    ...(site?.zones.filter((z) => z.active && z.name.toLowerCase().includes(ql)).map((z) => ({ kind: 'Zone', title: z.name, sub: z.kind, ...(handle.engine ? { go: () => handle.engine?.focusZone(z.id) } : { to: LIVE_FLOOR_PATH }) })) ?? []),
    ...(nav?.stations.filter((s) => (s.id + ' ' + s.name).toLowerCase().includes(ql)).slice(0, 6).map((s) => ({ kind: 'Station', title: `${s.id} · ${s.name}`, sub: s.type, ...(handle.engine ? { go: () => store.getState().selectStation(s.id) } : { to: LIVE_FLOOR_PATH, state: { locate: s.id } }) })) ?? []),
  ];
}
