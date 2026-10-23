import { useEditorShortcuts, type useDrawTools } from '../canvas/useDrawTools';
import type { Tool } from '../canvas/tools';
import { moveElements } from '../model/structure/ops';
import { moveShape } from '../model/shape';
import { setZoneShape } from '../model/zones';
import type { MapData, Selection } from '../model/types';
import type { useDraftEditor } from '../model/useDraftEditor';

type Zone = MapData['zones'][number];

/** Keyboard shortcuts of the editor: undo / redo, Esc / Enter while drawing, and arrows / Delete for the selected zone. */
export function useZoneShortcuts({
  tool,
  canEdit,
  editor,
  draw,
  zone,
  element,
  askDelete,
  onToolKey,
}: {
  tool: Tool;
  canEdit: boolean;
  editor: ReturnType<typeof useDraftEditor>;
  draw: ReturnType<typeof useDrawTools>;
  zone: Zone | undefined;
  /** the selected elements of the structure: arrows move them, Delete asks to remove them */
  element?: string[];
  askDelete: (d: NonNullable<Selection>) => void;
  onToolKey: (key: string) => boolean;
}) {
  useEditorShortcuts({
    tool,
    canEdit,
    ...editor,
    cancel: draw.cancel,
    finish: draw.finish,
    onToolKey,
    zone: zone
      ? {
          nudge: (dx, dy) =>
            editor.edit((m) => setZoneShape(m, zone.id, moveShape(zone.shape, dx, dy)), `nudge:${zone.id}`),
          remove: () => askDelete({ kind: 'zone', id: zone.id }),
        }
      : element
        ? {
            nudge: (dx, dy) => editor.edit((m) => moveElements(m, element, dx, dy), `nudge:${element.join()}`),
            remove: () => askDelete({ kind: 'element', id: element[element.length - 1], ids: element }),
          }
        : undefined,
  });
}
