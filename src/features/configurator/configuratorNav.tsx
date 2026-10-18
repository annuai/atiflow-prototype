import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import type { NavModel } from '@/shell/types';
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
import { KINDS } from '@/features/devices';
import { fleetPath, FLEETS_PATH } from '@/features/fleets';
import { useFleetDirectory } from '@/data/fleetDirectory';
import { wfStore } from '@/features/workflow-builder';
import { datasetStore } from '@/data/dataset';
import { useUnreadCount } from '@/features/notifications';
import { USERS_PATH } from '@/features/access';
import { useAccess } from '@/features/auth';
import { localized } from '@/i18n';
import { SidebarButton } from '@/shell/sidebar';

const nav = localized('nav');

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
      navigate(fleetPath(datasetStore.getState().fleets.at(-1)!.id));
    }
  };
  return (
    <>
      <SidebarButton icon={plusI} label={nav.items.createFleet} onPress={() => setOpen((o) => !o)} />
      {open && (
        <form
          className="sb-new-fleet"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input
            size="sm"
            aria-label={nav.items.fleetNameLabel}
            placeholder={nav.items.fleetNamePlaceholder}
            value={name}
            onChange={setName}
            autoFocus
          />
          <Button type="submit" size="sm" color="primary">
            {nav.items.addFleet}
          </Button>
        </form>
      )}
    </>
  );
}

/** Sidebar shared by every configurator page. The highlighted item follows the URL, so each page only has to be a route. */
export function useConfiguratorNav(): NavModel {
  const fleets = useFleetDirectory();
  const unread = useUnreadCount();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onWorkflows = pathname === WORKFLOWS_PATH || pathname.startsWith(`${WORKFLOWS_PATH}/workflows/`);
  const at = (route: string) => pathname.startsWith(`${WORKFLOWS_PATH}/${route}`);
  const { can, canManageUsers } = useAccess(); // the sidebar only offers what the user may open
  const groups = [
    {
      id: 'global',
      label: nav.groups.globalSetup,
      items: [
        can('configurator.robots') && {
          id: 'robots',
          label: nav.features['configurator.robots'],
          icon: robotsI,
          active: at(KINDS.robot.route),
          onSelect: () => navigate(`${WORKFLOWS_PATH}/${KINDS.robot.route}`),
        },
        can('configurator.maps') && {
          id: 'maps',
          label: nav.features['configurator.maps'],
          icon: mapsI,
          active: at('maps'),
          onSelect: () => navigate(`${WORKFLOWS_PATH}/maps`),
        },
        can('configurator.hardware') && {
          id: 'hw',
          label: nav.features['configurator.hardware'],
          icon: hardwareI,
          active: at(KINDS.hardware.route),
          onSelect: () => navigate(`${WORKFLOWS_PATH}/${KINDS.hardware.route}`),
        },
        canManageUsers && {
          id: 'users',
          label: nav.items.users,
          icon: usersI,
          active: pathname.startsWith(USERS_PATH),
          onSelect: () => navigate(USERS_PATH),
        },
      ],
    },
    {
      id: 'build',
      label: nav.groups.build,
      items: [
        can('configurator.master-data') && {
          id: 'md',
          label: nav.features['configurator.master-data'],
          icon: masterI,
          active: at('master-data'),
          onSelect: () => navigate(`${WORKFLOWS_PATH}/master-data`),
        },
        can('configurator.workflows') && {
          id: 'wf',
          label: nav.features['configurator.workflows'],
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
            label: nav.groups.fleets,
            items: [
              {
                id: 'all-fleets',
                label: nav.items.allFleets,
                icon: fleetI,
                active: pathname === FLEETS_PATH,
                onSelect: () => navigate(FLEETS_PATH),
              },
              ...fleets.map((f) => ({
                id: f.id,
                label: f.name,
                icon: fleetI,
                active: pathname.startsWith(fleetPath(f.id, '')),
                onSelect: () => navigate(fleetPath(f.id)),
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
        label: nav.items.notifications,
        icon: bellI,
        badge: unread || undefined,
        active: pathname === '/configurator/notifications',
        onSelect: () => navigate('/configurator/notifications'),
      },
      ...(can('configurator.settings')
        ? [
            {
              id: 'settings',
              label: nav.features['configurator.settings'],
              icon: gearI,
              active: pathname.startsWith(SETTINGS_PATH),
              onSelect: () => navigate(SETTINGS_PATH),
            },
          ]
        : []),
    ],
  };
}
