import { Badge } from '@/components/base/badges/badges';
import { fleetDirectory, useFleetName } from '@/data/fleetDirectory';
import { DataTable, type Column } from '@/components/data/DataTable';
import { nameOf } from '../model/validate';
import type { Device, DeviceKind } from '../model/types';
import { StatusBadge } from './StatusBadge';
import { t } from '../text';

/** The list table shared by Robots and Hardware: name + picture, type badge, assigned fleet, status. Rows open the detail page. */
export function DeviceTable({ kind, rows, onOpen }: { kind: DeviceKind; rows: Device[]; onOpen(d: Device): void }) {
  const columns: Column<Device>[] = [
    {
      id: 'name',
      sort: (d) => nameOf(d),
      header: kind.columns.name,
      cell: (d) => (
        <div className="flex items-center gap-3">
          {kind.thumb(d)}
          <span translate="no" className="text-sm font-bold whitespace-nowrap text-primary">
            {nameOf(d)}
          </span>
        </div>
      ),
    },
    {
      id: 'type',
      sort: (d) => kind.typeOf(d),
      header: kind.columns.type,
      cell: (d) => (
        <Badge size="md" type="pill-color" color="gray">
          {kind.typeOf(d)}
        </Badge>
      ),
    },
    {
      id: 'fleet',
      sort: (d) => fleetDirectory.nameOf(String(d.values.fleet ?? '')),
      header: t.list.columns.fleet,
      cell: (d) =>
        d.values.fleet ? (
          <FleetLabel id={String(d.values.fleet)} />
        ) : (
          <span className="text-quaternary">{t.list.unassigned}</span>
        ),
    },
    {
      id: 'status',
      sort: (d) => d.status,
      header: t.list.columns.status,
      headClassName: 'w-32',
      cell: (d) => <StatusBadge status={d.status} />,
    },
  ];
  return (
    <DataTable label={kind.plural} rows={rows} rowKey={nameOf} columns={columns} onRowAction={onOpen} minWidth={640} />
  );
}

/** A fleet's current name (follows a rename). */
function FleetLabel({ id }: { id: string }) {
  return <>{useFleetName(id)}</>;
}
