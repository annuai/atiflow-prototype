import { Package } from '@untitledui/icons';
import { EmptyState } from '@/components/data/EmptyState';
import { useMemo, useState } from 'react';
import { PackagePlus } from '@untitledui/icons';
import { SearchPrefixFilter } from '@/components/data/SearchPrefixFilter';
import { ModalShell } from '@/components/modal/ModalShell';
import { MaterialPicker, type PickerRow } from '@/features/master-data/components/MaterialPicker';
import { filterByPrefix, filterMaterials } from '@/features/master-data/model/logic';
import { masterDataStore, useMasterData } from '@/features/master-data/model/store';
import { notify } from '@/ui/toast';
import { copy } from '../copy';

function Body({ fleet, onOpenChange }: { fleet: string; onOpenChange(o: boolean): void }) {
  const materials = useMasterData((s) => s.materials);
  const groups = useMasterData((s) => s.groups);
  const [text, setText] = useState('');
  const [prefix, setPrefix] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const t = copy.assignMaterials;
  const rows: PickerRow[] = useMemo(
    () =>
      filterByPrefix(filterMaterials(materials, groups, { text, group: '' }), prefix)
        .filter((m) => !m.fleets.includes(fleet))
        .map((m) => ({
          code: m.code,
          name: m.name,
          group: groups.find((g) => g.id === m.group)?.name ?? '',
          status: 'available' as const,
        })),
    [materials, groups, text, prefix, fleet],
  );
  const save = () => {
    masterDataStore.getState().assignMaterials([...sel], fleet);
    onOpenChange(false);
    const d = t.done(sel.size, fleet);
    notify.success(d.title, d.body, 'materials-assigned');
  };
  return (
    <ModalShell
      isOpen
      onOpenChange={onOpenChange}
      icon={PackagePlus}
      title={t.title(fleet)}
      subtitle={t.subtitle}
      secondary={{ label: t.cancel, onPress: () => onOpenChange(false) }}
      primary={{ label: t.confirm(sel.size), isDisabled: sel.size === 0, onPress: save }}
    >
      <div className="flex flex-col gap-3 pt-2">
        <SearchPrefixFilter labels={t} text={text} onText={setText} prefix={prefix} onPrefix={setPrefix} />
        <div className="flex items-baseline justify-between text-sm text-tertiary">
          <span>{t.showing(rows.length)}</span>
          <span className="font-semibold text-secondary">{t.selected(sel.size)}</span>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Package} title={copy.emptyTitle.toAdd} subtext={t.none} size="sm" />
        ) : (
          <MaterialPicker rows={rows} selected={sel} onChange={setSel} />
        )}
      </div>
    </ModalShell>
  );
}
/** Assign materials from the Material Master Data to this fleet. Mounted only while open. */
export const AssignMaterialsModal = (p: { fleet: string; isOpen: boolean; onOpenChange(o: boolean): void }) =>
  p.isOpen ? <Body fleet={p.fleet} onOpenChange={p.onOpenChange} /> : null;
