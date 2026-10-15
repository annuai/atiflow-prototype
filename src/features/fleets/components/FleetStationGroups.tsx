import { EmptyState, NoResults } from '@/components/data/EmptyState';
import { useState } from 'react';
import { Edit05, SearchLg, Trash01, Package, LayersThree01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { DataTable, type Column } from '@/components/data/DataTable';
import { RowMenu } from '@/components/data/RowMenu';
import { ConfirmDialog } from '@/components/modal/ConfirmDialog';
import type { PickerRow } from '@/features/master-data/components/MaterialPicker';
import type { Material, MaterialGroup } from '@/features/master-data/model/types';
import { notify } from '@/ui/toast';
import { cx } from '@/utils/cx';
import { copy } from '../copy';
import { fleetsStore, profileOf, useFleets } from '../model/store';
import { AddToGroupModal } from './AddToGroupModal';
import { RenameGroupModal } from './RenameGroupModal';

interface Props {
  fleet: string;
  materials: Material[];
  masterGroups: MaterialGroup[];
  toolbarLeft: React.ReactNode;
  onAdd(): void;
}

/** "Station groups": list of groups (one per station of the fleet's map) and the materials of the selected group. */
export function FleetStationGroups({ fleet, materials, masterGroups, toolbarLeft, onAdd }: Props) {
  const groups = useFleets((s) => profileOf(s.profiles, fleet).groups);
  const [selectedId, setSelected] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [adding, setAdding] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [text, setText] = useState('');
  const q = text.trim().toLowerCase();
  const shownGroups = q
    ? groups.filter((g) =>
        [g.name, g.stationId, ...g.codes, ...materials.filter((m) => g.codes.includes(m.code)).map((m) => m.name)].some(
          (x) => x.toLowerCase().includes(q),
        ),
      )
    : groups;
  const group = shownGroups.find((g) => g.id === selectedId) ?? shownGroups[0];
  const groupName = (m: Material) => masterGroups.find((g) => g.id === m.group)?.name ?? '';
  const inGroup = group ? materials.filter((m) => group.codes.includes(m.code)) : [];
  const addable: PickerRow[] = materials
    .filter((m) => group && !group.codes.includes(m.code))
    .map((m) => ({
      code: m.code,
      name: m.name,
      group: masterGroups.find((g) => g.id === m.group)?.name ?? '',
      status: 'available' as const,
    }));
  const columns: Column<Material>[] = [
    {
      id: 'material',
      sort: (m) => m.name,
      header: copy.materials.columns.material,
      cell: (m) => (
        <div>
          <p className="text-sm font-medium text-primary">{m.name}</p>
          <p className="text-sm text-tertiary">{m.code}</p>
        </div>
      ),
    },
    {
      id: 'group',
      sort: (m) => groupName(m),
      header: copy.materials.columns.group,
      cell: (m) => (
        <Badge size="sm" type="pill-color" color="gray">
          {groupName(m)}
        </Badge>
      ),
    },
    {
      id: 'menu',
      header: '',
      headClassName: 'w-12',
      className: 'w-12 text-right',
      cell: (m) => (
        <RowMenu
          label={copy.groups.rowMenu.label}
          onAction={() => group && fleetsStore.getState().removeFromGroup(fleet, group.id, m.code)}
          items={[{ id: 'remove', label: copy.groups.rowMenu.remove, icon: Trash01 }]}
        />
      ),
    },
  ];
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {toolbarLeft}
        <div className="flex flex-wrap gap-3">
          <Input
            className="w-[260px]"
            size="sm"
            icon={SearchLg}
            aria-label={copy.groups.search}
            placeholder={copy.groups.search}
            value={text}
            onChange={setText}
          />
          <Button size="sm" color="primary" onPress={onAdd}>
            {copy.materials.addGroup}
          </Button>
        </div>
      </div>
      {groups.length === 0 ? (
        <EmptyState framed icon={LayersThree01} title={copy.emptyTitle.groups} subtext={copy.groups.empty} size="lg" />
      ) : (
        <div className="grid min-h-0 flex-1 items-stretch gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div
            className="overflow-hidden rounded-xl border border-secondary bg-primary"
            role="listbox"
            aria-label={copy.groups.list(groups.length)}
          >
            <p className="border-b border-secondary px-5 py-2 text-xs font-medium text-quaternary">
              {copy.groups.list(groups.length)}
            </p>
            {shownGroups.length === 0 && <NoResults size="sm" subtext={copy.groups.noMatch(text)} />}
            {shownGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                role="option"
                aria-selected={g.id === group?.id}
                onClick={() => setSelected(g.id)}
                className={cx(
                  'relative flex w-full cursor-pointer flex-col items-start gap-1.5 border-b border-secondary px-5 py-4 text-left outline-focus-ring last:border-b-0 focus-visible:outline-2',
                  g.id === group?.id ? 'bg-brand-primary' : 'hover:bg-primary_hover',
                )}
              >
                {g.id === group?.id && <span className="absolute inset-y-0 left-0 w-[3px] bg-fg-brand-primary" />}
                <span className="flex gap-1.5">
                  <Badge size="sm" type="pill-color" color="brand">
                    {g.stationId}
                  </Badge>
                  <Badge size="sm" type="pill-color" color="gray">
                    {copy.groups.materialsCount(g.codes.length)}
                  </Badge>
                </span>
                <span className="text-sm font-semibold text-primary">{g.name}</span>
              </button>
            ))}
          </div>
          {group && (
            <section className="overflow-hidden rounded-xl border border-secondary bg-primary" aria-label={group.name}>
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary px-5 py-4">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-lg font-semibold text-primary">{group.name}</h2>
                  <ButtonUtility
                    size="xs"
                    color="tertiary"
                    icon={Edit05}
                    tooltip={copy.groups.rename}
                    onPress={() => setRenaming(group)}
                  />
                  <ButtonUtility
                    size="xs"
                    color="tertiary"
                    icon={Trash01}
                    tooltip={copy.groups.deleteGroup}
                    onPress={() => setDeleting(group)}
                  />
                </div>
                <Button size="sm" color="secondary" onPress={() => setAdding(group)}>
                  {copy.groups.addMaterials}
                </Button>
              </header>
              {inGroup.length === 0 ? (
                <EmptyState icon={Package} title={copy.emptyTitle.groupMaterials} subtext={copy.groups.noMaterials} />
              ) : (
                <div className="overflow-auto">
                  <DataTable
                    plain
                    label={group.name}
                    rows={inGroup}
                    rowKey={(m) => m.code}
                    columns={columns}
                    minWidth={420}
                  />
                </div>
              )}
            </section>
          )}
        </div>
      )}
      <RenameGroupModal fleet={fleet} group={renaming} onOpenChange={(o) => !o && setRenaming(null)} />
      <AddToGroupModal fleet={fleet} group={adding} rows={addable} onOpenChange={(o) => !o && setAdding(null)} />
      <ConfirmDialog
        isOpen={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={copy.groups.deleteConfirm.title(deleting?.name ?? '')}
        description={copy.groups.deleteConfirm.body}
        confirmLabel={copy.groups.deleteConfirm.confirm}
        onConfirm={() => {
          if (deleting) {
            fleetsStore.getState().deleteGroup(fleet, deleting.id);
            setSelected('');
            notify.success(copy.groups.deleted(deleting.name), undefined, 'group-deleted');
          }
        }}
      />
    </>
  );
}
