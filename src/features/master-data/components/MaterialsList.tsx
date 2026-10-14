import { useMemo, useState } from 'react';
import { Database01, Edit05, Flag01, PackagePlus, Plus, SearchLg } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { Select } from '@/components/base/select/select';
import { EmptyState } from '@/components/application/empty-state/empty-state';
import { DataTable, type Column } from '@/components/data/DataTable';
import { RowMenu } from '@/components/data/RowMenu';
import { copy } from '../copy';
import { filterMaterials } from '../model/logic';
import { useMasterData } from '../model/store';
import type { Material } from '../model/types';
import { EditMaterialModal } from './EditMaterialModal';
import { FleetsModal } from './FleetsModal';

const ALL = '';
interface Props { onAddMore(): void; onAdd(): void }

/** The materials list: note, search + group filter, table with hover ⋮ menu. Materials cannot be deleted (workflows may use them). */
export function MaterialsList({ onAddMore, onAdd }: Props) {
  const materials = useMasterData((s) => s.materials); const groups = useMasterData((s) => s.groups);
  const [text, setText] = useState(''); const [group, setGroup] = useState(ALL); const [editing, setEditing] = useState<Material | null>(null); const [fleetsOf, setFleetsOf] = useState<Material | null>(null);
  const rows = useMemo(() => filterMaterials(materials, groups, { text, group }), [materials, groups, text, group]);
  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? copy.materials.noGroup;
  const columns: Column<Material>[] = [
    { id: 'material', sort: (m) => m.name, header: copy.materials.columns.material, cell: (m) => <div className="min-w-0"><p className="truncate text-sm font-medium text-primary">{m.name}</p><p className="text-sm text-tertiary">{m.code}</p></div> },
    { id: 'group', sort: (m) => groupName(m.group), header: copy.materials.columns.group, hint: copy.materials.groupHint, cell: (m) => groupName(m.group) },
    { id: 'fleet', sort: (m) => m.fleets.join(', '), header: copy.materials.columns.fleet, hint: copy.materials.fleetHint, cell: (m) => m.fleets.length ? <div className="flex flex-wrap gap-1">{m.fleets.map((f) => <Badge key={f} size="sm" type="pill-color" color="indigo">{f}</Badge>)}</div> : <span className="text-quaternary">{copy.materials.unassigned}</span> },
    { id: 'menu', header: '', headClassName: 'w-12', className: 'w-12 text-right', cell: (m) => <RowMenu label={copy.materials.rowMenu.label} onAction={(id) => (id === 'edit' ? setEditing(m) : setFleetsOf(m))}
      items={[{ id: 'edit', label: copy.materials.rowMenu.edit, icon: Edit05 }, { id: 'fleets', label: copy.materials.rowMenu.fleets, icon: Flag01 }]} /> },
  ];
  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex gap-3"><Button size="sm" color="secondary" iconLeading={Database01} onPress={onAddMore}>{copy.materials.addMore}</Button><Button size="sm" color="primary" iconLeading={Plus} onPress={onAdd}>{copy.materials.add}</Button></div>
      </div>
      {materials.length === 0 ? (
        <EmptyState size="md" className="py-10"><EmptyState.Header><EmptyState.FeaturedIcon icon={PackagePlus} color="gray" theme="modern" /></EmptyState.Header>
          <EmptyState.Content><EmptyState.Title>{copy.materials.empty.title}</EmptyState.Title><EmptyState.Description>{copy.materials.empty.description}</EmptyState.Description></EmptyState.Content>
          <EmptyState.Footer><Button size="md" color="primary" iconLeading={Plus} onPress={onAdd}>{copy.materials.empty.action}</Button></EmptyState.Footer></EmptyState>
      ) : (<>
        <p className="text-sm text-tertiary">{copy.materials.note}</p>
        <div className="flex flex-wrap gap-3">
          <Input className="min-w-60 flex-1" size="sm" icon={SearchLg} aria-label={copy.materials.searchPlaceholder} placeholder={copy.materials.searchPlaceholder} value={text} onChange={setText} />
          <Select size="sm" aria-label="Group" className="w-[200px]" selectedKey={group || 'all'} onSelectionChange={(k) => setGroup(k === 'all' ? ALL : String(k))}
            items={[{ id: 'all', label: copy.materials.groupFilter(copy.materials.allGroups) }, ...groups.map((g) => ({ id: g.id, label: copy.materials.groupFilter(g.name) }))]}>{(item) => <Select.Item {...item} />}</Select>
        </div>
        {rows.length === 0 ? <p className="p-10 text-center text-sm text-tertiary">{copy.materials.noMatch(text)}</p>
          : <div className="min-h-0 overflow-auto rounded-xl border border-secondary"><DataTable label={copy.title} rows={rows} rowKey={(m) => m.code} columns={columns} minWidth={560} stickyHeader /></div>}
      </>)}
      <EditMaterialModal material={editing} onOpenChange={(o) => !o && setEditing(null)} />
      <FleetsModal material={fleetsOf} onOpenChange={(o) => !o && setFleetsOf(null)} />
    </>
  );
}
