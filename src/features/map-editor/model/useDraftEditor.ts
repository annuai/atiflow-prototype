import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { DraftEditor } from './draftEditor';

/** The draft editor of one map for a component: `edit`, `undo`, `redo` and whether the buttons are usable. See `DraftEditor`. */
export function useDraftEditor(mapId: string, draftId: string | undefined, afterUndoRedo: () => void) {
  const editor = useMemo(() => new DraftEditor(mapId), [mapId]);
  useEffect(() => {
    editor.onUndoRedo(afterUndoRedo);
  });
  useEffect(() => editor.attach(draftId), [editor, draftId]);
  useSyncExternalStore(editor.subscribe, () => editor.version);
  return {
    edit: editor.edit,
    undo: editor.undo,
    redo: editor.redo,
    canUndo: editor.canUndo,
    canRedo: editor.canRedo,
    dirty: editor.dirty,
    discardChanges: editor.discardChanges,
  };
}
