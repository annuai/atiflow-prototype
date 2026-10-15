import { Link } from 'react-router-dom';
import { Trash01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { RowMenu } from '@/components/data/RowMenu';
import { StatusBadge } from '@/features/devices/components/StatusBadge';
import type { Device, DeviceKind } from '@/features/devices/model/types';
import { nameOf } from '@/features/devices/model/validate';
import { copy } from '../copy';

interface Props {
  kind: DeviceKind;
  device: Device;
  layout: 'tile' | 'row';
  /** Fleet page the card is shown on: the linked page shows Fleets > fleet > item in its breadcrumb. */ fleet: string;
  onUnassign(): void;
}

/**
 * A robot or hardware item inside a fleet: picture, name, type, status (tile) or a compact row. The whole card links to the item's own page
 * (the one from the Robots / Hardware flow); the ⋮ menu (shown on hover) sits above the link.
 */
export function DeviceCard({ kind, device, layout, fleet, onUnassign }: Props) {
  const to = `/configurator/${kind.route}/${encodeURIComponent(nameOf(device))}`;
  const name = nameOf(device);
  const link = (cls: string) => (
    <Link
      to={to}
      state={{ fleet }}
      className={`${cls} outline-focus-ring after:absolute after:inset-0 focus-visible:after:outline-2`}
      aria-label={`Open ${name}`}
    >
      {name}
    </Link>
  );
  const menu = (
    <RowMenu
      label={copy.overview.menu}
      onAction={onUnassign}
      items={[{ id: 'unassign', label: copy.overview.unassign, icon: Trash01 }]}
    />
  );
  if (layout === 'row') {
    return (
      <div className="group relative flex items-center gap-3 rounded-xl border border-secondary bg-primary p-3 shadow-xs transition hover:bg-primary_hover">
        <div className="shrink-0 scale-75 origin-left">{kind.thumb(device)}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate">{link('text-md font-semibold text-primary')}</p>
          <Badge size="sm" type="pill-color" color="gray">
            {kind.typeOf(device)}
          </Badge>
        </div>
        <div className="relative z-10">{menu}</div>
      </div>
    );
  }
  return (
    <div className="group relative overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs transition hover:shadow-md">
      <div className="relative grid h-28 place-items-center bg-secondary">
        <div className="absolute top-2 left-2">
          <StatusBadge status={device.status} type="pill-color" />
        </div>
        <div className="absolute top-2 right-2 z-10">{menu}</div>
        {kind.thumb(device)}
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <p className="truncate">{link('text-md font-semibold text-primary')}</p>
        <Badge size="sm" type="pill-color" color="gray">
          {kind.typeOf(device)}
        </Badge>
      </div>
    </div>
  );
}
