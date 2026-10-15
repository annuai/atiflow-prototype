import { Badge } from '@/components/base/badges/badges';
import { DataTable, type Column } from '@/components/data/DataTable';
import { FleetName } from '@/components/data/FleetSelect';
import { fmtDuration } from '@/features/dashboard/data/derive';
import { copy } from '../copy';
import type { Call } from '../model/types';

const when = (t: number) =>
  new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const waited = (c: Call) => (c.resolvedAt ? Math.round((c.resolvedAt - c.openedAt) / 1000) : 0);
const COLUMNS: Column<Call>[] = [
  {
    id: 'call',
    header: copy.log.columns.call,
    cell: (c) => <span className="font-medium text-primary">{c.id}</span>,
    sort: (c) => c.id,
  },
  {
    id: 'kind',
    header: copy.log.columns.kind,
    cell: (c) => (
      <Badge size="sm" color={c.severity === 'critical' ? 'error' : 'warning'}>
        {copy.kind[c.kind]}
      </Badge>
    ),
    sort: (c) => c.kind,
  },
  { id: 'robots', header: copy.log.columns.robots, cell: (c) => c.robots.join(', '), sort: (c) => c.robots[0] },
  { id: 'fleet', header: copy.log.columns.fleet, cell: (c) => <FleetName id={c.fleetId} />, sort: (c) => c.fleetId },
  { id: 'opened', header: copy.log.columns.opened, cell: (c) => when(c.openedAt), sort: (c) => c.openedAt },
  { id: 'waited', header: copy.log.columns.waited, cell: (c) => fmtDuration(waited(c)), sort: waited },
  { id: 'by', header: copy.log.columns.by, cell: (c) => c.resolvedBy ?? '', sort: (c) => c.resolvedBy ?? '' },
  {
    id: 'result',
    header: copy.log.columns.result,
    cell: (c) => <span className="text-tertiary">{c.resolution}</span>,
    sort: (c) => c.resolution ?? '',
  },
];
export const ResolvedLog = ({ rows }: { rows: Call[] }) => (
  <DataTable
    label="Resolved calls"
    rows={rows}
    rowKey={(c) => c.id + c.openedAt}
    columns={COLUMNS}
    minWidth={900}
    plain
  />
);
