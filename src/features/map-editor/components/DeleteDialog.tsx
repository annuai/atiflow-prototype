import { ConfirmDialog } from '@/components/modal/ConfirmDialog';
import { copy } from '../copy';
import { modelOf } from '../model/structure/ops';
import type { MapData, Selection } from '../model/types';

type Thing = NonNullable<Selection>;
/** The texts of "delete this station / staging area / road / zone?" for what is about to be deleted. */
function texts(data: MapData, what: Thing, usedBy: string[]) {
  const named = {
    station: data.stations.find((s) => s.id === what.id)?.name,
    staging: data.stagingAreas.find((s) => s.id === what.id)?.name,
    road: data.roads.find((s) => s.id === what.id)?.name,
    zone: data.zones.find((s) => s.id === what.id)?.name,
    element: modelOf(data).elements.find((s) => s.id === what.id)?.name,
  }[what.kind as 'station' | 'staging' | 'road' | 'zone' | 'element'];
  const n = named ?? '';
  switch (what.kind) {
    case 'station':
      return {
        title: copy.stations.form.deleteTitle(n),
        body: usedBy.length ? copy.stations.form.deleteUsed(usedBy.join(', ')) : copy.stations.form.deleteBody,
      };
    case 'staging':
      return { title: copy.staging.form.deleteTitle(n), body: copy.staging.form.deleteBody };
    case 'road':
      return { title: copy.routes.form.deleteTitle(n), body: copy.routes.form.deleteBody };
    case 'element':
      if (what.ids && what.ids.length > 1)
        return {
          title: copy.structure.form.deleteManyTitle(what.ids.length),
          body: copy.structure.form.deleteManyBody,
        };
      return { title: copy.structure.form.deleteTitle(n || what.id), body: copy.structure.form.deleteBody };
    default:
      return { title: copy.zones.form.deleteTitle(n), body: copy.zones.form.deleteBody };
  }
}

/** The words on the red button: what is being deleted. */
const deleteLabel = (kind?: Thing['kind']) =>
  kind === 'staging'
    ? copy.staging.form.delete
    : kind === 'road'
      ? copy.routes.form.delete
      : kind === 'element'
        ? copy.structure.form.delete
        : kind === 'zone'
          ? copy.zones.form.delete
          : copy.stations.form.delete;

/** Asks before deleting a thing of the map (a station used by a workflow says which workflows use it). */
export function DeleteDialog({
  deleting,
  data,
  usedBy,
  onClose,
  onConfirm,
}: {
  deleting: Thing | null;
  data: MapData;
  /** workflows that use the thing (only stations can be used) */
  usedBy: (stationId: string) => string[];
  onClose(): void;
  onConfirm(what: Thing): void;
}) {
  const t = deleting
    ? texts(data, deleting, deleting.kind === 'station' ? usedBy(deleting.id) : [])
    : { title: '', body: '' };
  return (
    <ConfirmDialog
      isOpen={!!deleting}
      onOpenChange={(o) => !o && onClose()}
      title={t.title}
      description={t.body}
      confirmLabel={deleteLabel(deleting?.kind)}
      onConfirm={() => deleting && onConfirm(deleting)}
    />
  );
}
