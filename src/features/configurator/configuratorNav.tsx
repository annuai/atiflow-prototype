import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import type { NavModel, SearchHit } from '@/shell/types';
import robotsI from '@/ui/icons/robots.svg';
import mapsI from '@/ui/icons/maps.svg';
import hardwareI from '@/ui/icons/hardware.svg';
import usersI from '@/ui/icons/users.svg';
import masterI from '@/ui/icons/master-data.svg';
import workflowsI from '@/ui/icons/workflows.svg';
import fleetI from '@/ui/icons/fleet.svg';
import plusI from '@/ui/icons/plus-square.svg';
import bellI from '@/ui/icons/bell.svg';
import gearI from '@/ui/icons/settings.svg';
import { KINDS, deviceStore, nameOf } from '@/features/devices';
import { fleetPath, FLEETS_PATH } from '@/features/fleets';
import { builderNodeHits, useFleetNames, wfStore } from '@/features/workflow-builder';
import { datasetStore } from '@/data/dataset';
import { useUnreadCount } from '@/features/notifications';
import { USERS_PATH } from '@/features/access';
import { canNow, useAccess } from '@/features/auth';

export const SETTINGS_PATH = '/configurator/settings';
export const WORKFLOWS_PATH = '/configurator'; // "Workflows": opens a new workflow; /configurator/workflows/<id> shows one

/** "Create new fleet" row + inline name form (sidebar group extra). Creating a fleet opens its fleet page. */
function NewFleet() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const add = () => {
    const n = name;
    if (wfStore.getState().createFleet(n)) {
      setName('');
      setOpen(false);
      navigate(fleetPath(datasetStore.getState().fleets.at(-1)!.name));
    }
  };
  return (
    <>
      <button className="sb-item" onClick={() => setOpen((o) => !o)}>
        <span>
          <img src={plusI} alt="" />
          <span className="t">Create new fleet</span>
        </span>
      </button>
      {open && (
        <form
          className="new-fleet"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input
            size="sm"
            aria-label="New fleet name"
            placeholder="Fleet name"
            value={name}
            onChange={setName}
            autoFocus
          />
          <Button type="submit" size="sm" color="primary">
            Add
          </Button>
        </form>
      )}
    </>
  );
}

/** Sidebar shared by every configurator page. The highlighted item follows the URL, so each page only has to be a route. */
export function useConfiguratorNav(): NavModel {
  const names = useFleetNames();
  const unread = useUnreadCount();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onWorkflows = pathname === WORKFLOWS_PATH || pathname.startsWith(`${WORKFLOWS_PATH}/workflows/`);
  const at = (route: string) => pathname.startsWith(`${WORKFLOWS_PATH}/${route}`);
  const { can, canManageUsers } = useAccess(); // the sidebar only offers what the user may open
  const groups = [
    {
      id: 'global',
      label: 'Global Setup',
      items: [
        can('configurator.robots') && {
          id: 'robots',
          label: 'Robots',
          icon: robotsI,
          active: at(KINDS.robot.route),
          onSelect: () => navigate(`${WORKFLOWS_PATH}/${KINDS.robot.route}`),
        },
        can('configurator.maps') && {
          id: 'maps',
          label: 'Maps',
          icon: mapsI,
          active: at('maps'),
          onSelect: () => navigate(`${WORKFLOWS_PATH}/maps`),
        },
        can('configurator.hardware') && {
          id: 'hw',
          label: 'Hardware',
          icon: hardwareI,
          active: at(KINDS.hardware.route),
          onSelect: () => navigate(`${WORKFLOWS_PATH}/${KINDS.hardware.route}`),
        },
        canManageUsers && {
          id: 'users',
          label: 'Users',
          icon: usersI,
          active: pathname.startsWith(USERS_PATH),
          onSelect: () => navigate(USERS_PATH),
        },
      ],
    },
    {
      id: 'build',
      label: 'Build',
      items: [
        can('configurator.master-data') && {
          id: 'md',
          label: 'Master Data',
          icon: masterI,
          active: at('master-data'),
          onSelect: () => navigate(`${WORKFLOWS_PATH}/master-data`),
        },
        can('configurator.workflows') && {
          id: 'wf',
          label: 'Workflows',
          icon: workflowsI,
          active: onWorkflows,
          onSelect: () => navigate(WORKFLOWS_PATH),
        },
      ],
    },
    ...(can('configurator.fleets')
      ? [
          {
            id: 'fleets',
            label: 'Fleets',
            items: [
              {
                id: 'all-fleets',
                label: 'All fleets',
                icon: fleetI,
                active: pathname === FLEETS_PATH,
                onSelect: () => navigate(FLEETS_PATH),
              },
              ...names.map((n) => ({
                id: n,
                label: n,
                icon: fleetI,
                active: pathname.startsWith(fleetPath(n, '')),
                onSelect: () => navigate(fleetPath(n)),
              })),
            ],
            extra: <NewFleet />,
          },
        ]
      : []),
  ]
    .map((g) => ({ ...g, items: g.items.filter(Boolean) as NavModel['groups'][number]['items'] }))
    .filter((g) => g.items.length || g.extra);
  return {
    groups,
    footerItems: [
      {
        id: 'notif',
        label: 'Notifications',
        icon: bellI,
        badge: unread || undefined,
        active: pathname === '/configurator/notifications',
        onSelect: () => navigate('/configurator/notifications'),
      },
      ...(can('configurator.settings')
        ? [
            {
              id: 'settings',
              label: 'Settings',
              icon: gearI,
              active: pathname.startsWith(SETTINGS_PATH),
              onSelect: () => navigate(SETTINGS_PATH),
            },
          ]
        : []),
    ],
  };
}

/** Top-bar search for every configurator page: fleets, robots, hardware (open their page) and, on the builder, the nodes of the open workflow. */
export function configuratorHits(q: string): SearchHit[] {
  const ql = q.toLowerCase();
  const d = deviceStore.getState();
  const devices = (['robot', 'hardware'] as const)
    .filter((id) => canNow(`configurator.${id === 'robot' ? 'robots' : 'hardware'}`))
    .flatMap((id) =>
      d[id]
        .filter((x) => (nameOf(x) + ' ' + KINDS[id].typeOf(x)).toLowerCase().includes(ql))
        .slice(0, 5)
        .map((x) => ({
          kind: KINDS[id].singular,
          title: nameOf(x),
          sub: KINDS[id].typeOf(x),
          to: `${WORKFLOWS_PATH}/${KINDS[id].route}/${encodeURIComponent(nameOf(x))}`,
        })),
    );
  return [
    ...(canNow('configurator.fleets')
      ? datasetStore
          .getState()
          .fleets.map((f) => f.name)
          .filter((n) => n.toLowerCase().includes(ql))
          .map((n) => ({ kind: 'Fleet', title: n, to: fleetPath(n) }))
      : []),
    ...devices,
    ...(window.location.pathname.startsWith(`${WORKFLOWS_PATH}/workflows/`) && canNow('configurator.workflows')
      ? builderNodeHits(q)
      : []),
  ];
}
