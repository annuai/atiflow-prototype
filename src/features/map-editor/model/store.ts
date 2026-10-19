import { createPersistedStore } from '@/data/persistedStore';
import { useStore } from 'zustand';
import { services } from '@/services';
import { normaliseData } from './seed';
import { restoreWorkAreas } from './workAreas';
import type { SiteLayout } from '@/core/types';
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
  /** A map made by an import: no published version yet, only a draft (nothing reaches the floor until it is published); the first publish gets `firstNumber`. */
  createImported(mapId: string, firstNumber: number, data: MapData, by: string, now?: number): void;
  /** Start the draft: a copy of `fromNumber` (default: the latest published). Only one draft per map: an existing one is kept. */
  startDraft(mapId: string, by: string, fromNumber?: number, now?: number): MapVersion | null;
  /** Change the draft (never a published version). */
  updateDraft(mapId: string, edit: (d: MapData) => MapData): void;
  /** Put a published version's data into the draft (starts one when there is none): "restore" / "update to the latest". */
  restoreToDraft(mapId: string, fromNumber: number, by: string, now?: number): MapVersion | null;
  discardDraft(mapId: string): void;
  /** Forget a map's whole history (when the map itself is deleted). */
  removeMap(mapId: string): void;
  /** Turn the draft into the next published version; returns its number. */
  publish(mapId: string, by: string, now?: number): number | null;
  /** Gives the Work areas that were made from an older saved zone their real outline and tint again (once; nothing else changes, published versions included). */
  restoreAreas(site: SiteLayout, fleets: { color: string; areas: string[] }[]): void;
  reset(): void;
}
const put = (s: Saved, mapId: string, versions: MapVersion[]): Saved => ({
  ...s,
  [mapId]: { ...s[mapId], versions },
});

/** What the service holds, with every version's data completed (older saved maps lack newer fields). */
const loadVersions = (): Saved =>
  Object.fromEntries(
    Object.entries(services().mapVersions.read()).map(([k, h]) => [
      k,
      { ...h, versions: h.versions.map((v) => ({ ...v, data: normaliseData(v.data) })) },
    ]),
  );
export const mapVersionsStore = createPersistedStore<MapVersionsState, Saved>(
  {
    name: 'map versions',
    read: loadVersions,
    save: (v) => services().mapVersions.save(v),
    pick: (s) => s.byMap,
    apply: (d) => ({ byMap: d }),
    watch: ['byMap'],
    delayMs: 400,
    devHandle: '__mapVersions',
  },
  (set, get) => ({
    restoreAreas(site, fleets) {
      const by = get().byMap;
      let changed = false;
      const next: Saved = {};
      for (const [id, h] of Object.entries(by)) {
        const versions = h.versions.map((v) => {
          const data = restoreWorkAreas(v.data, site, fleets);
          if (data === v.data) return v;
          changed = true;
          return { ...v, data };
        });
        next[id] = { ...h, versions };
      }
      if (changed) set({ byMap: next });
    },
    ensure(mapId, number, data, now = Date.now()) {
      const had = get().byMap[mapId]?.versions;
      if (had?.length) {
        // a map nobody has edited (only its System-made first version) follows the current lane map, so it never shows an out-of-date copy
        const [only] = had;
        if (had.length === 1 && only.createdBy === 'System' && JSON.stringify(only.data) !== JSON.stringify(data))
          set({ byMap: put(get().byMap, mapId, [{ ...only, data }]) });
        return;
      }
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
    createImported(mapId, firstNumber, data, by, now = Date.now()) {
      if (get().byMap[mapId]) return;
      const draft: MapVersion = {
        id: uid(),
        mapId,
        status: 'draft',
        number: null,
        basedOn: null,
        createdAt: now,
        createdBy: by,
        data,
      };
      set({ byMap: { ...get().byMap, [mapId]: { versions: [draft], firstNumber } } });
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
    removeMap(mapId) {
      const { [mapId]: _gone, ...rest } = get().byMap;
      set({ byMap: rest });
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
      const latest = latestOf(h)?.number;
      const number = latest == null ? (h.firstNumber ?? 1) : latest + 1;
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
  }),
);
export const useMapVersions = <T>(sel: (s: MapVersionsState) => T) => useStore(mapVersionsStore, sel);
