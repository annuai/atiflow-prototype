import { Package } from '@untitledui/icons';
import { EmptyState, NoResults } from '@/components/data/EmptyState';
import { useState } from 'react';
import { PackagePlus } from '@untitledui/icons';
import { ModalShell } from '@/components/modal/ModalShell';
import { MaterialPicker, type PickerRow } from '@/features/master-data/components/MaterialPicker';
import { copy } from '../copy';
import { fleetsStore } from '../model/store';

function Body({ fleet, groupId, groupName, rows, onOpenChange }: { fleet: string; groupId: string; groupName: string; rows: PickerRow[]; onOpenChange(o: boolean): void }) {
  const [sel, setSel] = useState<Set<string>>(new Set()); const t = copy.groups;
  return (
    <ModalShell isOpen onOpenChange={onOpenChange} icon={PackagePlus} title={t.addTitle(groupName)} subtitle={t.addSubtitle} secondary={{ label: t.form.cancel, onPress: () => onOpenChange(false) }}
      primary={{ label: t.addConfirm(sel.size), isDisabled: sel.size === 0, onPress: () => { fleetsStore.getState().addToGroup(fleet, groupId, [...sel]); onOpenChange(false); } }}>
      <div className="flex flex-col gap-3 pt-2">
        <p className="text-right text-sm font-semibold text-secondary">{copy.materials.selected(sel.size)}</p>
        {rows.length === 0 ? <EmptyState icon={Package} title={copy.emptyTitle.toAdd} subtext={copy.materials.empty} size="sm" /> : <MaterialPicker rows={rows} selected={sel} onChange={setSel} />}
      </div>
    </ModalShell>
  );
}
/** Add fleet materials (not yet in this group) to a station group. */
export const AddToGroupModal = (p: { fleet: string; group: { id: string; name: string } | null; rows: PickerRow[]; onOpenChange(o: boolean): void }) => (p.group ? <Body fleet={p.fleet} groupId={p.group.id} groupName={p.group.name} rows={p.rows} onOpenChange={p.onOpenChange} /> : null);
