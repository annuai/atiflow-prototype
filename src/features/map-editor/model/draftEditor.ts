import { emptyHistory, record, redo as redoStep, undo as undoStep, type History } from './history';
import { draftOf, mapVersionsStore } from './store';
import type { MapData } from './types';

/**
 * Editing the draft of one map with undo and redo, as a plain object (no React): `edit(fn)` changes the draft, every change is an undo step (changes with the same `key` in quick
 * succession, such as dragging a station, are one step). The history belongs to one open draft: `attach(draftId)` starts it empty whenever another draft is shown. In memory only.
 * `subscribe` / `version` let a component follow `canUndo` / `canRedo` (`useDraftEditor`).
 */
export class DraftEditor {
  private history: History<MapData> = emptyHistory();
  private draftId: string | undefined;
  /** the draft as it was when it was opened for editing (what "discard changes" goes back to) */
  private baseline: MapData | undefined;
  private listeners = new Set<() => void>();
  /** bumps when the history changes, so a component can tell */
  version = 0;
  private afterUndoRedo: () => void = () => {};
  /** what to do after an undo or redo (the page clears the shape that was being drawn) */
  onUndoRedo(fn: () => void) {
    this.afterUndoRedo = fn;
  }
  constructor(private readonly mapId: string) {}

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };
  private emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }
  private live = () => draftOf(mapVersionsStore.getState().byMap[this.mapId])?.data;

  /** The draft that is shown now (a different one starts with a clean history). */
  attach(draftId: string | undefined) {
    if (this.draftId === draftId) return;
    this.draftId = draftId;
    this.baseline = this.live();
    this.history = emptyHistory();
    this.emit();
  }
  get canUndo() {
    return this.history.past.length > 0;
  }
  /** Unpublished edits made since the draft was opened (what leaving would lose track of). */
  get dirty() {
    return this.history.past.length > 0;
  }
  /** Put the draft back as it was when it was opened and forget the undo steps. */
  discardChanges = () => {
    const base = this.baseline;
    if (base) mapVersionsStore.getState().updateDraft(this.mapId, () => base);
    this.history = emptyHistory();
    this.emit();
  };
  get canRedo() {
    return this.history.future.length > 0;
  }
  edit = (fn: (d: MapData) => MapData, key?: string) => {
    const cur = this.live();
    if (!cur) return;
    const next = fn(cur);
    if (next === cur) return;
    this.history = record(this.history, cur, key, Date.now());
    mapVersionsStore.getState().updateDraft(this.mapId, () => next);
    this.emit();
  };
  private step(apply: typeof undoStep) {
    const cur = this.live();
    const r = cur && apply(this.history, cur);
    if (!r) return;
    this.history = r.history;
    mapVersionsStore.getState().updateDraft(this.mapId, () => r.value);
    this.emit();
    this.afterUndoRedo();
  }
  undo = () => this.step(undoStep);
  redo = () => this.step(redoStep);
}
