import { createStore } from 'zustand/vanilla';
import { createPersister } from '@/data/persist';
import { useStore } from 'zustand';
import { services } from '@/services';
import { normaliseData } from './seed';
import type { MapData, MapHistory, MapVersion } from './types';

/**
 * The version history of every map, saved in this browser. A map has published versions (v5, v6...: read-only for good, one of them is the latest) and at most ONE draft, the only
 * thing that can be edited. Publishing turns the draft into the next version. (A server later = another StorageBackend; the rules here stay.)
 */
type Saved = Record<string, MapHistory>;

export const draftOf = (h?: MapHistory) => h?.versions.find((v) => v.status === 'draft');
export const publishedOf = (h?: MapHistory) =>
  (h?.versions.filter((v) => v.status === 'published') ?? []).sort((a, b) => (b.number ?? 0) - (a.number ?? 0));
export const latestOf = (h?: MapHistory) => publishedOf(h)[0];
const uid = () => `mv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export interface MapVersionsState {
  byMap: Saved;
  /** The first published version of a map (once; later calls do nothing). */
  ensure(mapId: string, number: number, data: MapData, now?: number): void;
  /** Start the draft: a copy of `fromNumber` (default: the latest published). Only one draft per map: an existing one is kept. */
  startDraft(mapId: string, by: string, fromNumber?: number, now?: number): MapVersion | null;
  /** Change the draft (never a published version). */
  updateDraft(mapId: string, edit: (d: MapData) => MapData): void;
  /** Put a published version's data into the draft (starts one when there is none): "restore" / "update to the latest". */
  restoreToDraft(mapId: string, fromNumber: number, by: string, now?: number): MapVersion | null;
  discardDraft(mapId: string): void;
  /** Turn the draft into the next published version; returns its number. */
  publish(mapId: string, by: string, now?: number): number | null;
  reset(): void;
}
const put = (s: Saved, mapId: string, versions: MapVersion[]): Saved => ({ ...s, [mapId]: { versions } });

export const mapVersionsStore = createStore<MapVersionsState>((set, get) => ({
  byMap: Object.fromEntries(
    Object.entries(services().mapVersions.read() ?? {}).map(([k, h]) => [
      k,
      { versions: h.versions.map((v) => ({ ...v, data: normaliseData(v.data) })) },
    ]),
  ),
  ensure(mapId, number, data, now = Date.now()) {
    if (get().byMap[mapId]?.versions.length) return;
    set({
      byMap: put(get().byMap, mapId, [
        {
          id: uid(),
          mapId,
          status: 'published',
          number,
          basedOn: null,
          createdAt: now,
          createdBy: 'System',
          publishedAt: now,
          publishedBy: 'System',
          data,
        },
      ]),
    });
  },
  startDraft(mapId, by, fromNumber, now = Date.now()) {
    const h = get().byMap[mapId];
    if (!h) return null;
    const existing = draftOf(h);
    if (existing) return existing;
    const from = fromNumber ? h.versions.find((v) => v.number === fromNumber) : latestOf(h);
    if (!from) return null;
    const draft: MapVersion = {
      id: uid(),
      mapId,
      status: 'draft',
      number: null,
      basedOn: from.number,
      createdAt: now,
      createdBy: by,
      data: structuredClone(from.data),
    };
    set({ byMap: put(get().byMap, mapId, [...h.versions, draft]) });
    return draft;
  },
  updateDraft(mapId, edit) {
    const h = get().byMap[mapId];
    const d = draftOf(h);
    if (!h || !d) return;
    set({
      byMap: put(
        get().byMap,
        mapId,
        h.versions.map((v) => (v.id === d.id ? { ...v, data: edit(v.data) } : v)),
      ),
    });
  },
  restoreToDraft(mapId, fromNumber, by, now = Date.now()) {
    const h = get().byMap[mapId];
    const from = h?.versions.find((v) => v.number === fromNumber && v.status === 'published');
    if (!h || !from) return null;
    const d = draftOf(h);
    if (!d) return get().startDraft(mapId, by, fromNumber, now);
    const next = { ...d, basedOn: from.number, data: structuredClone(from.data) };
    set({
      byMap: put(
        get().byMap,
        mapId,
        h.versions.map((v) => (v.id === d.id ? next : v)),
      ),
    });
    return next;
  },
  discardDraft(mapId) {
    const h = get().byMap[mapId];
    if (!h) return;
    set({
      byMap: put(
        get().byMap,
        mapId,
        h.versions.filter((v) => v.status !== 'draft'),
      ),
    });
  },
  publish(mapId, by, now = Date.now()) {
    const h = get().byMap[mapId];
    const d = draftOf(h);
    if (!h || !d) return null;
    const number = (latestOf(h)?.number ?? 0) + 1;
    set({
      byMap: put(
        get().byMap,
        mapId,
        h.versions.map((v) =>
          v.id === d.id ? { ...v, status: 'published' as const, number, publishedAt: now, publishedBy: by } : v,
        ),
      ),
    });
    return number;
  },
  reset() {
    services().mapVersions.clear();
    set({ byMap: {} });
  },
}));
export const useMapVersions = <T>(sel: (s: MapVersionsState) => T) => useStore(mapVersionsStore, sel);

let saved = mapVersionsStore.getState().byMap;
const persist = createPersister('map versions', (v: Saved) => services().mapVersions.save(v), { delayMs: 400 });
mapVersionsStore.subscribe((s) => {
  if (s.byMap === saved) return;
  saved = s.byMap;
  persist.queue(s.byMap);
});
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __mapVersions: mapVersionsStore });
