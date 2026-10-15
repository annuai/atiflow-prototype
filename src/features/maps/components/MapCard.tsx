import { Link } from 'react-router-dom';
import { Badge } from '@/components/base/badges/badges';
import { lastUpdated } from '@/utils/timeAgo';
import { copy } from '../copy';
import { MapThumbnail } from './MapThumbnail';
import { routingName } from '../model/routing';
import type { FleetMap } from '../model/types';

/** One map: preview, version + routing chip, name, the fleets that run on it and its station count. */
export function MapCard({ map, fleets }: { map: FleetMap; fleets: string[] }) {
  const row = (label: string, value: string, muted?: boolean) => (
    <div className="flex items-baseline justify-between gap-4 text-sm"><span className="text-xs tracking-wide text-tertiary uppercase">{label}</span><span className={muted ? 'text-quaternary' : 'text-right font-medium text-primary'}>{value}</span></div>
  );
  return (
    <article className="relative overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs transition hover:shadow-md focus-within:ring-2 focus-within:ring-brand" aria-label={map.name}>
      <Link to={`/configurator/maps/${map.id}`} className="absolute inset-0 z-10 outline-hidden" aria-label={`Open ${map.name} in the map editor`} />
      <div className="relative h-44 bg-[#f4f7f6]">
        <MapThumbnail fleetLive={map.fleetLive} className="size-full" />
        <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/70 py-1 pr-3 pl-1 text-xs font-medium text-white">
          <Badge size="sm" type="pill-color" color="brand">{copy.card.version(map.version)}</Badge>{routingName(map.version)}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-4">
        <h2 className="truncate text-lg font-semibold text-primary" title={map.name}>{map.name}</h2>
        {fleets.length ? row(copy.card.fleet, fleets.join(', ')) : row(copy.card.fleet, copy.card.unassigned, true)}
        <div className="flex items-baseline justify-between gap-4 text-sm" title={new Date(map.updatedAt).toLocaleString()}><span className="text-xs tracking-wide text-tertiary uppercase">{copy.card.updated}</span><span className="text-right font-medium text-primary">{lastUpdated(map.updatedAt, Date.now())}</span></div>
      </div>
    </article>
  );
}
