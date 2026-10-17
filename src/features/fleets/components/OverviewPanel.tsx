import { MapThumbnail } from '@/features/maps';
import type { FC } from 'react';
import { Cube01, Server01 } from '@untitledui/icons';
import { EmptyState } from '@/components/data/EmptyState';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Map01, Trash01 } from '@untitledui/icons';
import { Dropdown } from '@/components/base/dropdown/dropdown';
import { ConfirmDialog } from '@/components/modal/ConfirmDialog';
import { can } from '@/features/access';
import { useAuth } from '@/features/auth';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { KINDS, deviceStore, useDevices, type DeviceKind, nameOf } from '@/features/devices';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { useMap } from '../model/maps';
import { fleetsStore, profileOf, useFleets } from '../model/store';
import { AssignMapModal } from './AssignMapModal';
import { AssignDevicesModal } from './AssignDevicesModal';
import { DeviceCard } from './DeviceCard';

function Section({
  title,
  count,
  action,
  onAction,
  children,
  empty,
}: {
  title: string;
  count: string;
  action: string;
  onAction(): void;
  children: ReactNode;
  empty?: { icon: FC<{ className?: string }>; title: string; subtext: string };
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          <Badge size="sm" type="pill-color" color="gray">
            {count}
          </Badge>
        </div>
        <Button size="sm" color="secondary" onPress={onAction}>
          {action}
        </Button>
      </div>
      {empty ? <EmptyState framed icon={empty.icon} title={empty.title} subtext={empty.subtext} size="sm" /> : children}
    </section>
  );
}

/** Fleet overview: assigned map, assigned robots (tiles) and hardware (rows). Assign / unassign here updates the Robots and Hardware pages too. */
export function OverviewPanel({ fleet }: { fleet: string }) {
  const profile = useFleets((s) => profileOf(s.profiles, fleet));
  const map = useMap(profile.mapId);
  const user = useAuth((s) => s.user);
  const canEditMaps = !!user && can(user, 'configurator.maps');
  const [unassigningMap, setUnassigningMap] = useState(false);
  const [assigning, setAssigning] = useState<DeviceKind | null>(null);
  const [assigningMap, setAssigningMap] = useState(false);
  const robots = useDevices((s) => s.robot).filter((d) => d.values.fleet === fleet);
  const hardware = useDevices((s) => s.hardware).filter((d) => d.values.fleet === fleet);
  const unassign = (kind: DeviceKind, name: string) => () => {
    deviceStore.getState().update(kind.id, name, { fleet: '' });
    const u = copy.overview.unassigned(name, fleet);
    notify.success(u.title, u.body, 'device-unassigned');
  };
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-primary">{copy.overview.map}</h2>
        {map ? (
          <div className="relative flex overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs transition hover:shadow-md">
            <MapThumbnail map={map} fleetLive={map.fleetLive} className="hidden h-32 w-52 shrink-0 sm:block" />
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 p-5">
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
                <Button size="sm" color="secondary" onPress={() => setAssigningMap(true)}>
                  {copy.overview.changeMap}
                </Button>
                <Dropdown.Root>
                  <Dropdown.DotsButton aria-label={copy.overview.mapMenu} />
                  <Dropdown.Popover className="w-48">
                    <Dropdown.Menu onAction={() => setUnassigningMap(true)}>
                      <Dropdown.Item id="unassign" icon={Trash01} label={copy.overview.unassignMap} />
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown.Root>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-xl font-semibold text-primary">
                  {canEditMaps ? (
                    <Link
                      to={`/configurator/maps/${encodeURIComponent(map.id)}`}
                      aria-label={copy.overview.openInEditor(map.name)}
                      className="outline-focus-ring after:absolute after:inset-0 focus-visible:after:outline-2"
                    >
                      {map.name}
                    </Link>
                  ) : (
                    map.name
                  )}
                </p>
                <Badge size="sm" type="pill-color" color="brand">
                  {map.tag}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-tertiary">{copy.overview.mapVersion}</p>
                <p className="text-md font-semibold text-primary">{copy.overview.version(map.version)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-primary p-8 text-center">
            <p className="text-sm text-tertiary">{copy.overview.noMap}</p>
            <Button size="md" color="primary" iconLeading={Map01} onPress={() => setAssigningMap(true)}>
              {copy.overview.assignMap}
            </Button>
          </div>
        )}
      </section>
      <Section
        title={copy.overview.robots}
        count={copy.meta.robots(robots.length)}
        action={copy.overview.assignRobot}
        onAction={() => setAssigning(KINDS.robot)}
        empty={
          robots.length ? undefined : { icon: Cube01, title: copy.emptyTitle.robots, subtext: copy.overview.noRobots }
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {robots.map((d) => (
            <DeviceCard
              key={nameOf(d)}
              kind={KINDS.robot}
              device={d}
              layout="tile"
              fleet={fleet}
              onUnassign={unassign(KINDS.robot, nameOf(d))}
            />
          ))}
        </div>
      </Section>
      <Section
        title={copy.overview.hardware}
        count={copy.meta.hardware(hardware.length)}
        action={copy.overview.assignHardware}
        onAction={() => setAssigning(KINDS.hardware)}
        empty={
          hardware.length
            ? undefined
            : { icon: Server01, title: copy.emptyTitle.hardware, subtext: copy.overview.noHardware }
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {hardware.map((d) => (
            <DeviceCard
              key={nameOf(d)}
              kind={KINDS.hardware}
              device={d}
              layout="row"
              fleet={fleet}
              onUnassign={unassign(KINDS.hardware, nameOf(d))}
            />
          ))}
        </div>
      </Section>
      <AssignMapModal fleet={fleet} isOpen={assigningMap} onOpenChange={setAssigningMap} />
      <ConfirmDialog
        isOpen={unassigningMap}
        onOpenChange={setUnassigningMap}
        title={copy.overview.unassignMapTitle(fleet)}
        description={copy.overview.unassignMapBody(profile.groups.length)}
        confirmLabel={copy.overview.unassignMap}
        onConfirm={() => {
          fleetsStore.getState().unassignMap(fleet);
          const d = copy.overview.mapUnassigned(map?.name ?? 'The map', fleet);
          notify.success(d.title, d.body, 'map-unassigned');
        }}
      />
      <AssignDevicesModal
        kind={assigning ?? KINDS.robot}
        fleet={fleet}
        isOpen={!!assigning}
        onOpenChange={(o) => !o && setAssigning(null)}
      />
    </div>
  );
}
