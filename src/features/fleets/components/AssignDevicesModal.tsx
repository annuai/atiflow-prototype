import { Server01 } from '@untitledui/icons';
import { EmptyState } from '@/components/data/EmptyState';
import { useState } from 'react';
import { Badge } from '@/components/base/badges/badges';
import { DataTable, type Column } from '@/components/data/DataTable';
import { ModalShell } from '@/components/modal/ModalShell';
import { StatusBadge } from '@/features/devices/components/StatusBadge';
import { deviceStore, useDevices } from '@/features/devices/model/store';
import type { Device, DeviceKind } from '@/features/devices/model/types';
import { nameOf } from '@/features/devices/model/validate';
import { notify } from '@/ui/toast';
import { copy } from '../copy';

function Body({ kind, fleet, onOpenChange }: { kind: DeviceKind; fleet: string; onOpenChange(o: boolean): void }) {
  const free = useDevices((s) => s[kind.id]).filter((d) => !d.values.fleet); const [sel, setSel] = useState<Set<string>>(new Set());
  const t = copy.assignDevices;
  const columns: Column<Device>[] = [
    { id: 'name', sort: (d) => nameOf(d), header: t.columns.name, cell: (d) => <div className="flex items-center gap-3 whitespace-nowrap">{kind.thumb(d)}<span className="font-semibold text-primary">{nameOf(d)}</span></div> },
    { id: 'type', sort: (d) => kind.typeOf(d), header: t.columns.type, cell: (d) => <Badge size="sm" type="pill-color" color="gray">{kind.typeOf(d)}</Badge> },
    { id: 'status', sort: (d) => d.status, header: t.columns.status, cell: (d) => <StatusBadge status={d.status} /> },
  ];
  const save = () => { sel.forEach((n) => deviceStore.getState().update(kind.id, n, { fleet })); onOpenChange(false); const d = t.done(sel.size, fleet); notify.success(d.title, d.body, 'devices-assigned'); };
  return (
    <ModalShell isOpen onOpenChange={onOpenChange} icon={kind.icon} title={t.title(kind.singular, fleet)} subtitle={t.subtitle(kind.plural)} size="lg"
      secondary={{ label: t.cancel, onPress: () => onOpenChange(false) }} primary={{ label: t.confirm(sel.size, kind.singular), isDisabled: sel.size === 0, onPress: save }}>
      <div className="flex flex-col gap-3 pt-2">
        {free.length === 0 ? <EmptyState icon={Server01} title={copy.emptyTitle.devices} subtext={t.none(kind.plural)} size="sm" /> : (<>
          <p className="text-right text-sm font-semibold text-secondary">{t.selected(sel.size)}</p>
          <div className="max-h-[min(340px,40vh)] overflow-auto rounded-xl border border-secondary"><DataTable label={kind.plural} rows={free} rowKey={nameOf} columns={columns} selection={{ selected: sel, onChange: setSel }} stickyHeader /></div></>)}
      </div>
    </ModalShell>
  );
}
/** Pick unassigned robots / hardware and put them in the fleet. Mounted only while open. */
export const AssignDevicesModal = (p: { kind: DeviceKind; fleet: string; isOpen: boolean; onOpenChange(o: boolean): void }) => (p.isOpen ? <Body kind={p.kind} fleet={p.fleet} onOpenChange={p.onOpenChange} /> : null);
