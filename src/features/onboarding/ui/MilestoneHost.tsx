import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/base/badges/badges';
import { useDataset } from '@/data/dataset';
import { useFleets } from '@/features/fleets';
import { KINDS, StatusBadge, nameOf, useDevices } from '@/features/devices';
import { MapThumbnail, useMaps } from '@/features/maps';
import { copy } from '../copy';
import { milestoneFor, type MilestoneId } from '../model/milestones';
import { useSetup } from '../model/useSetup';
import { MilestoneDialog } from './MilestoneDialog';

const NEXT: Record<MilestoneId, (mapId?: string) => string> = {
  robot: () => '/configurator/maps?new=generate',
  map: (id) => (id ? `/configurator/maps/${id}` : '/configurator/maps'),
  fleet: () => '/configurator/master-data/materials',
};

/**
 * Watches setup and, the moment a robot, a map or a fleet is finished, opens the matching celebration with the next thing to do. Mounted once in the configurator's shell. Nothing opens
 * for what the site already had when the page loaded.
 */
export function MilestoneHost() {
  const setup = useSetup();
  const navigate = useNavigate();
  const prev = useRef<typeof setup | null>(null);
  const [shown, setShown] = useState<MilestoneId | null>(null);
  const robots = useDevices((s) => s.robot);
  const maps = useMaps();
  const fleets = useDataset((s) => s.fleets);
  const allRobots = useDataset((s) => s.robot);
  const profiles = useFleets((s) => s.profiles);
  useEffect(() => {
    const m = milestoneFor(prev.current, setup);
    prev.current = setup;
    if (!m) return;
    const t = window.setTimeout(() => setShown(m), 350); // (the dialog that made the step lets go first)
    return () => window.clearTimeout(t);
  }, [setup]);
  if (!shown) return null;
  const done = () => setShown(null);
  const robot = robots.at(-1);
  const map = maps.at(-1);
  const fleet = fleets.at(-1);
  const t = copy.milestone;
  const preview =
    shown === 'robot' && robot ? (
      <div className="flex items-center gap-3">
        {KINDS.robot.thumb(robot)}
        <div className="min-w-0 flex-1">
          <p className="truncate text-md font-semibold text-primary" translate="no">
            {nameOf(robot)}
          </p>
          <p className="text-xs text-tertiary">{KINDS.robot.typeOf(robot)}</p>
        </div>
        <StatusBadge status={robot.status} />
        <Badge size="sm" color="success">
          {t.recent}
        </Badge>
      </div>
    ) : shown === 'map' && map ? (
      <div className="flex items-center gap-3">
        <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-primary ring-1 ring-secondary">
          <MapThumbnail map={map} fleetLive={map.fleetLive} className="size-full" />
        </div>
        <p className="min-w-0 flex-1 truncate text-md font-semibold text-primary" translate="no">
          {map.name}
        </p>
        <Badge size="sm" color="gray">
          {t.draft}
        </Badge>
      </div>
    ) : fleet ? (
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 truncate text-md font-semibold text-primary" translate="no">
          {fleet.name}
        </p>
        <span className="text-xs text-tertiary">
          {t.fleetCount(
            allRobots.filter((r) => r.values.fleet === fleet.id).length,
            maps.find((m) => m.id === profiles[fleet.id]?.mapId)?.name ?? t.noMapYet,
          )}
        </span>
      </div>
    ) : null;
  return (
    <MilestoneDialog
      isOpen
      title={t[shown].title}
      body={t[shown].body}
      preview={preview}
      cta={t[shown].cta}
      onSkip={done}
      onCta={() => {
        done();
        navigate(NEXT[shown](map?.id));
      }}
    />
  );
}
