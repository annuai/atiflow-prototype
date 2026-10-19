import type { Module } from '../components/ModuleToolbar';
import { copy } from '../copy';
import { deleteRoad } from './roads';
import { deleteStagingArea } from './staging';
import { deleteStation } from './stations';
import { deleteElements } from './structure/ops';
import { draftOf, latestOf } from './store';
import type { MapData, Selection } from './types';
import { deleteZone } from './zones';
import { zoneType } from './zoneTypes';

/** Which module's panel belongs to a selected thing. */
export function moduleOfSelection(data: MapData, sel: NonNullable<Selection>): Module {
  if (sel.kind === 'station' || sel.kind === 'staging') return 'stations';
  if (sel.kind === 'road') return 'routes';
  if (sel.kind === 'element') return 'structure';
  return zoneType(data.zones.find((z) => z.id === sel.id)?.type ?? '').module === 'exclusive' ? 'exclusive' : 'zones';
}

/** Removes the selected thing from the map. */
export function deleteSelected(m: MapData, d: NonNullable<Selection>): MapData {
  if (d.kind === 'station') return deleteStation(m, d.id);
  if (d.kind === 'staging') return deleteStagingArea(m, d.id);
  if (d.kind === 'road') return deleteRoad(m, d.id);
  if (d.kind === 'element') return deleteElements(m, d.ids ?? [d.id]);
  return deleteZone(m, d.id);
}

export type Viewing = 'draft' | number | null;
type VersionOf = NonNullable<ReturnType<typeof draftOf>>;

/** The version on screen: the one asked for, else the draft, else the latest published. */
export function versionShown(history: Parameters<typeof draftOf>[0], viewing: Viewing) {
  const draft = draftOf(history),
    latest = latestOf(history);
  if (viewing === 'draft') return { draft, latest, current: draft };
  if (typeof viewing === 'number')
    return { draft, latest, current: history?.versions.find((v) => v.number === viewing && v.status === 'published') };
  return { draft, latest, current: draft ?? latest };
}

/** The badge in the header: draft, the latest published version, or an older one being looked at. */
export function versionBadge(current: VersionOf, latest: VersionOf | undefined, isDraft: boolean) {
  if (isDraft) return { label: copy.draft, color: 'warning' as const };
  if (current.number === latest?.number) return { label: copy.published(current.number!), color: 'success' as const };
  return { label: copy.viewing(current.number!), color: 'gray' as const };
}
