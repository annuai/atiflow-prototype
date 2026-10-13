import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { notify } from '@/ui/toast';
import type { NavModel, SearchHit } from '@/shell/types';
import robotsI from '@/ui/icons/robots.svg'; import mapsI from '@/ui/icons/maps.svg'; import hardwareI from '@/ui/icons/hardware.svg'; import usersI from '@/ui/icons/users.svg';
import masterI from '@/ui/icons/master-data.svg'; import workflowsI from '@/ui/icons/workflows.svg'; import fleetI from '@/ui/icons/fleet.svg'; import plusI from '@/ui/icons/plus-square.svg';
import bellI from '@/ui/icons/bell.svg'; import gearI from '@/ui/icons/settings.svg';
import { KINDS } from '@/features/devices/model/kinds';
import { deviceStore } from '@/features/devices/model/store';
import { nameOf } from '@/features/devices/model/validate';
import { fleetPath } from '@/features/fleets/paths';
import { builderNodeHits } from '@/features/workflow-builder/builderNav';
import { datasetStore } from '@/data/dataset';
import { useUnreadCount } from '@/features/notifications/NotificationsProvider';
import { useFleetNames, wfStore } from '@/features/workflow-builder/model/store';

export const WORKFLOWS_PATH = '/configurator';          // "Workflows": opens a new workflow; /configurator/workflows/<id> shows one
const soon = (name: string) => () => notify.info(`${name} isn't part of this prototype`, 'This prototype covers Workflows, Robots, Hardware, Maps and Master Data.', 'soon');

/** "Create new fleet" row + inline name form (sidebar group extra). Creating a fleet opens its fleet page. */
function NewFleet() {
  const [open, setOpen] = useState(false); const [name, setName] = useState(''); const navigate = useNavigate();
  const add = () => { const n = name; if (wfStore.getState().createFleet(n)) { setName(''); setOpen(false); navigate(fleetPath(datasetStore.getState().fleets.at(-1)!.name)); } };
  return (
    <>
      <button className="sb-item" onClick={() => setOpen((o) => !o)}><span><img src={plusI} alt="" /><span className="t">Create new fleet</span></span></button>
      {open && <form className="new-fleet" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <Input size="sm" aria-label="New fleet name" placeholder="Fleet name" value={name} onChange={setName} autoFocus />
        <Button type="submit" size="sm" color="primary">Add</Button></form>}
    </>
  );
}

/** Sidebar shared by every configurator page. The highlighted item follows the URL, so each page only has to be a route. */
export function useConfiguratorNav(): NavModel {
  const names = useFleetNames(); const unread = useUnreadCount();
  const { pathname } = useLocation(); const navigate = useNavigate();
  const onWorkflows = pathname === WORKFLOWS_PATH || pathname.startsWith(`${WORKFLOWS_PATH}/workflows/`); const at = (route: string) => pathname.startsWith(`${WORKFLOWS_PATH}/${route}`);
  return {
    groups: [
      { id: 'global', label: 'Global Setup', items: [
        { id: 'robots', label: 'Robots', icon: robotsI, active: at(KINDS.robot.route), onSelect: () => navigate(`${WORKFLOWS_PATH}/${KINDS.robot.route}`) },
        { id: 'maps', label: 'Maps', icon: mapsI, active: at('maps'), onSelect: () => navigate(`${WORKFLOWS_PATH}/maps`) },
        { id: 'hw', label: 'Hardware', icon: hardwareI, active: at(KINDS.hardware.route), onSelect: () => navigate(`${WORKFLOWS_PATH}/${KINDS.hardware.route}`) },
        { id: 'users', label: 'Users', icon: usersI, onSelect: soon('Users') }] },
      { id: 'build', label: 'Build', items: [{ id: 'md', label: 'Master Data', icon: masterI, active: at('master-data'), onSelect: () => navigate(`${WORKFLOWS_PATH}/master-data`) }, { id: 'wf', label: 'Workflows', icon: workflowsI, active: onWorkflows, onSelect: () => navigate(WORKFLOWS_PATH) }] },
      { id: 'fleets', label: 'Fleets', items: names.map((n) => ({ id: n, label: n, icon: fleetI, active: pathname.startsWith(fleetPath(n, '')), onSelect: () => navigate(fleetPath(n)) })), extra: <NewFleet /> },
    ],
    footerItems: [{ id: 'notif', label: 'Notifications', icon: bellI, badge: unread || undefined, active: pathname === '/configurator/notifications', onSelect: () => navigate('/configurator/notifications') }, { id: 'settings', label: 'Settings', icon: gearI, onSelect: soon('Settings') }],
  };
}

/** Top-bar search for every configurator page: fleets, robots, hardware (open their page) and, on the builder, the nodes of the open workflow. */
export function configuratorHits(q: string): SearchHit[] {
  const ql = q.toLowerCase(); const s = wfStore.getState(); const d = deviceStore.getState();
  const devices = (['robot', 'hardware'] as const).flatMap((id) => d[id].filter((x) => (nameOf(x) + ' ' + KINDS[id].typeOf(x)).toLowerCase().includes(ql)).slice(0, 5)
    .map((x) => ({ kind: KINDS[id].singular, title: nameOf(x), sub: KINDS[id].typeOf(x), to: `${WORKFLOWS_PATH}/${KINDS[id].route}/${encodeURIComponent(nameOf(x))}` })));
  return [
    ...datasetStore.getState().fleets.map((f) => f.name).filter((n) => n.toLowerCase().includes(ql)).map((n) => ({ kind: 'Fleet', title: n, to: fleetPath(n) })),
    ...devices,
    ...(window.location.pathname.startsWith(`${WORKFLOWS_PATH}/workflows/`) ? builderNodeHits(q) : []),
  ];
}
