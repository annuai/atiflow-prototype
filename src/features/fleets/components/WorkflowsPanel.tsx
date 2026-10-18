import { GitBranch01 } from '@untitledui/icons';
import { EmptyState, NoResults } from '@/components/data/EmptyState';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchLg, Edit05 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { RowMenu } from '@/components/data/RowMenu';
import { DataTable, type Column } from '@/components/data/DataTable';
import { isKept, useWorkflow, wfStore, workflowsOfFleet } from '@/features/workflow-builder';
import { workflowSummary, type WorkflowRow } from '../model/workflows';
import { copy } from '../copy';
import type { FleetId } from '@/data/fleets';

/** Workflows tab: the fleet's workflow(s) read straight from the Workflow Builder. Rows and "Make New Workflow" open the builder on this fleet. */
export function WorkflowsPanel({ fleet }: { fleet: FleetId }) {
  const navigate = useNavigate();
  const workflows = useWorkflow((s) => s.workflows);
  const [text, setText] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const rows: WorkflowRow[] = useMemo(
    () => workflowsOfFleet(workflows, fleet).filter(isKept).map(workflowSummary),
    [fleet, workflows],
  );
  const shown = rows.filter(
    (r) =>
      !text.trim() ||
      [r.name, r.materials.join(' '), r.trigger].some((x) => x.toLowerCase().includes(text.trim().toLowerCase())),
  );
  const open = (r: WorkflowRow) => navigate(`/configurator/workflows/${r.id}`);
  const make = () => navigate(`/configurator/workflows/${wfStore.getState().startWorkflow(fleet)}`);
  const t = copy.workflows;
  const columns: Column<WorkflowRow>[] = [
    {
      id: 'workflow',
      sort: (r) => r.name,
      header: t.columns.workflow,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-primary">{r.name}</p>
          <p className="text-sm text-tertiary">{t.nodes(r.nodes)}</p>
        </div>
      ),
    },
    {
      id: 'materials',
      sort: (r) => r.materials.join(', '),
      header: t.columns.materials,
      cell: (r) => (r.materials.length ? r.materials.join(', ') : t.none),
    },
    {
      id: 'trigger',
      sort: (r) => r.trigger,
      header: t.columns.trigger,
      cell: (r) => (
        <Badge size="sm" type="pill-color" color="gray">
          {r.trigger}
        </Badge>
      ),
    },
    {
      id: 'status',
      sort: (r) => (r.published ? 0 : 1),
      header: t.columns.status,
      headClassName: 'w-28',
      className: 'w-28',
      cell: (r) => <span className="text-primary">{r.published ? t.active : t.draft}</span>,
    },
    {
      id: 'menu',
      header: '',
      headClassName: 'w-12',
      className: 'w-12 text-right',
      cell: (r) => (
        <RowMenu label={t.rowMenu} onAction={() => open(r)} items={[{ id: 'open', label: t.open, icon: Edit05 }]} />
      ),
    },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-primary">{t.title}</h2>
        <div className="flex flex-wrap gap-3">
          <Input
            className="w-60"
            size="sm"
            icon={SearchLg}
            aria-label={t.search}
            placeholder={t.search}
            value={text}
            onChange={setText}
          />
          <Button size="sm" color="primary" onPress={make}>
            {t.make}
          </Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState framed icon={GitBranch01} title={copy.emptyTitle.workflows} subtext={t.empty} size="lg" />
      ) : shown.length === 0 ? (
        <NoResults subtext={t.noMatch(text)} />
      ) : (
        <div className="overflow-auto rounded-xl border border-secondary sm:overflow-clip">
          <DataTable
            plain
            label={t.title}
            rows={shown}
            rowKey={(r) => r.id}
            columns={columns}
            onRowAction={open}
            selection={{ selected: sel, onChange: setSel }}
            minWidth={560}
          />
          <p className="border-t border-secondary px-5 py-3 text-sm text-tertiary">
            {t.showing(shown.length, rows.length)}
          </p>
        </div>
      )}
    </div>
  );
}
