import { useState } from 'react';
import { Trash01 } from '@untitledui/icons';
import { Link } from 'react-router-dom';
import { Dropdown } from '@/components/base/dropdown/dropdown';
import { ConfirmDialog } from '@/components/modal/ConfirmDialog';
import { notify } from '@/ui/toast';
import { lastEdit, useMapVersions } from '@/features/map-editor';
import { useNow } from '@/hooks/use-now';
import { Badge } from '@/components/base/badges/badges';
import { lastUpdated } from '@/utils/timeAgo';
import { copy } from '../copy';
import { MapThumbnail } from './MapThumbnail';
import { deleteMap, deleteRefusal } from '../model/deleteMap';
import { routingName } from '../model/routing';
import type { FleetMap } from '../model/types';
import { t } from '../text';
import { formatDate } from '@/i18n';

/** One map: preview, version + routing chip, name, the fleets that run on it and its station count. */
export function MapCard({ map, fleets }: { map: FleetMap; fleets: string[] }) {
  const now = useNow();
  const history = useMapVersions((s) => s.byMap[map.id]);
  const edited = Math.max(map.updatedAt, lastEdit(history) ?? 0); // the newest of when the map was made and when it was last worked on
  const [asking, setAsking] = useState(false);
  const why = deleteRefusal(map, fleets);
  // a map a fleet runs on (or a built-in one) is not deleted: a toast says why, the menu does not change
  const onDelete = () => {
    if (!why) return setAsking(true);
    notify.warning(
      copy.cardMenu.blocked(map.name),
      why === 'assigned' ? copy.cardMenu.assigned(fleets.join(', ')) : copy.cardMenu.builtIn,
      `map-delete-${map.id}`,
    );
  };
  const row = (label: string, value: string, muted?: boolean) => (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-xs tracking-wide text-tertiary uppercase">{label}</span>
      <span className={muted ? 'text-quaternary' : 'text-right font-medium text-primary'}>{value}</span>
    </div>
  );
  return (
    <article
      className="group relative overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs transition hover:shadow-md focus-within:ring-2 focus-within:ring-brand"
      aria-label={map.name}
    >
      <Link
        to={`/configurator/maps/${map.id}`}
        className="absolute inset-0 z-10 outline-hidden"
        aria-label={t.maps.openInEditor(map.name)}
      />
      <div className="relative h-44 bg-[#f4f7f6]">
        <MapThumbnail map={map} fleetLive={map.fleetLive} className="size-full" />
        <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/70 py-1 pr-3 pl-1 text-xs font-medium text-white">
          <Badge size="sm" type="pill-color" color="brand">
            {copy.card.version(map.version)}
          </Badge>
          {routingName(map.version)}
        </span>
        <div className="absolute top-2 right-2 z-20">
          <Dropdown.Root>
            <Dropdown.DotsButton
              aria-label={copy.cardMenu.menu}
              className="grid size-8 place-items-center bg-primary/90 opacity-0 shadow-xs ring-1 ring-secondary group-focus-within:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100 [@media(pointer:coarse)]:opacity-100"
            />
            <Dropdown.Popover className="w-48">
              <Dropdown.Menu onAction={onDelete}>
                <Dropdown.Item id="delete" icon={Trash01} label={copy.cardMenu.delete} />
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.Root>
        </div>
      </div>
      <div className="flex flex-col gap-2 p-4">
        <h2 className="truncate text-lg font-semibold text-primary" title={map.name}>
          {map.name}
        </h2>
        {fleets.length ? row(copy.card.fleet, fleets.join(', ')) : row(copy.card.fleet, copy.card.unassigned, true)}
        <div className="flex items-baseline justify-between gap-4 text-sm" title={formatDate(edited, 'full')}>
          <span className="text-xs tracking-wide text-tertiary uppercase">{copy.card.updated}</span>
          <span className="text-right font-medium text-primary">{lastUpdated(edited, now)}</span>
        </div>
      </div>
      <ConfirmDialog
        isOpen={asking}
        onOpenChange={setAsking}
        title={copy.cardMenu.title(map.name)}
        description={copy.cardMenu.body}
        confirmLabel={copy.cardMenu.confirm}
        onConfirm={() => {
          void deleteMap(map, fleets).then((no) => {
            if (!no) notify.success(copy.cardMenu.done(map.name), undefined, 'map-deleted');
          });
        }}
      />
    </article>
  );
}
