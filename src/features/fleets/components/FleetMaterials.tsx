import { Package } from '@untitledui/icons';
import { EmptyState, NoResults } from '@/components/data/EmptyState';
import { useMemo, useState } from 'react';
import { Plus, SearchLg, Trash01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { DataTable, type Column } from '@/components/data/DataTable';
import { RowMenu } from '@/components/data/RowMenu';
import { fleetsUsingMaterial } from '@/features/workflow-builder/model/usage';
import { wfStore } from '@/features/workflow-builder/model/store';
import { masterDataStore } from '@/features/master-data/model/store';
import type { Material } from '@/features/master-data/model/types';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { stationsOfMaterial } from '../model/logic';
import { fleetsStore, profileOf, useFleets } from '../model/store';

interface Props { fleet: string; materials: Material[]; total: number; onAssign(): void; onGroup(codes: string[]): void; toolbarLeft: React.ReactNode }

/** "All materials": the materials assigned to this fleet with the stations that stock them. Select rows to group them; ⋮ unassigns (refused while the fleet's workflow uses it). */
export function FleetMaterials({ fleet, materials, total, onAssign, onGroup, toolbarLeft }: Props) {
  const groups = useFleets((s) => profileOf(s.profiles, fleet).groups); const [text, setText] = useState(''); const [sel, setSel] = useState<Set<string>>(new Set());
  const rows = useMemo(() => { const q = text.trim().toLowerCase(); return q ? materials.filter((m) => [m.code, m.name, ...stationsOfMaterial(groups, m.code)].some((x) => x.toLowerCase().includes(q))) : materials; }, [materials, text, groups]);
  const unassign = (m: Material) => {
    if (fleetsUsingMaterial(wfStore.getState().workflows, m.code).includes(fleet)) { notify.warning(copy.materials.inUse.title, copy.materials.inUse.body(m.code), 'material-in-use'); return; }
    masterDataStore.getState().unassignMaterial(m.code, fleet); fleetsStore.getState().pruneMaterial(fleet, m.code); setSel((s) => { const n = new Set(s); n.delete(m.code); return n; });
    const u = copy.materials.unassigned(m.code, fleet); notify.success(u.title, u.body, 'material-unassigned');
  };
  const columns: Column<Material>[] = [
    { id: 'material', sort: (m) => m.name, header: copy.materials.columns.material, cell: (m) => <div className="min-w-0"><p className="truncate text-sm font-medium text-primary">{m.name}</p><p className="text-sm text-tertiary">{m.code}</p></div> },
    { id: 'stations', sort: (m) => stationsOfMaterial(groups, m.code).join(', '), header: copy.materials.columns.stations, cell: (m) => { const s = stationsOfMaterial(groups, m.code); return s.length ? <div className="flex flex-wrap gap-1">{s.map((id) => <Badge key={id} size="sm" type="pill-color" color="brand">{id}</Badge>)}</div> : <span className="text-tertiary">{copy.materials.notAssigned}</span>; } },
    { id: 'menu', header: '', headClassName: 'w-12', className: 'w-12 text-right', cell: (m) => <RowMenu label={copy.materials.rowMenu.label} onAction={() => unassign(m)} items={[{ id: 'unassign', label: copy.materials.rowMenu.unassign, icon: Trash01 }]} /> },
  ];
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {toolbarLeft}
        <div className="flex flex-wrap gap-3">
          {sel.size > 0 && <Button size="sm" color="secondary" onPress={() => onGroup([...sel])}>{copy.materials.groupSelected(sel.size)}</Button>}
          <Input className="w-60" size="sm" icon={SearchLg} aria-label={copy.materials.search} placeholder={copy.materials.search} value={text} onChange={setText} />
          <Button size="sm" color="primary" iconTrailing={Plus} onPress={onAssign}>{copy.materials.assign}</Button>
        </div>
      </div>
      {materials.length === 0 ? <EmptyState framed icon={Package} title={copy.emptyTitle.materials} subtext={copy.materials.empty} size="lg" />
        : rows.length === 0 ? <NoResults subtext={copy.materials.noMatch(text)} />
        : (<div className="min-h-0 overflow-auto rounded-xl border border-secondary"><DataTable plain label={copy.tabs.materials} rows={rows} rowKey={(m) => m.code} columns={columns} selection={{ selected: sel, onChange: setSel }} minWidth={520} stickyHeader />
            <p className="border-t border-secondary px-5 py-3 text-sm text-tertiary">{copy.materials.showing(rows.length, total)}</p></div>)}
    </>
  );
}
