import { Button } from '@/components/base/buttons/button';
import { copy } from '../copy';
import { modelOf, updateElements } from '../model/structure/ops';
import type { MapData } from '../model/types';
import { ColorPicker } from './ColorPicker';

/** Several elements selected at once: one colour for all, delete them together, or clear the selection. */
export function MultiPanel({
  data,
  ids,
  editable,
  edit,
  onClear,
  onDelete,
}: {
  data: MapData;
  ids: string[];
  editable: boolean;
  edit(fn: (d: MapData) => MapData): void;
  onClear(): void;
  onDelete(): void;
}) {
  const t = copy.structure;
  const f = t.form;
  const mine = modelOf(data).elements.filter((e) => ids.includes(e.id));
  const sameColor = mine.every((e) => e.color === mine[0]?.color) ? mine[0]?.color : undefined;
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-primary">{t.multi.title(ids.length)}</h3>
        <Button size="sm" color="tertiary" onPress={onClear}>
          {t.multi.clear}
        </Button>
      </div>
      <p className="text-xs text-tertiary">{t.multi.hint}</p>
      <ColorPicker
        label={f.color}
        value={sameColor}
        inherit={f.defaultColor}
        custom={f.customColor}
        disabled={!editable}
        onChange={(color) => edit((d) => updateElements(d, ids, { color }))}
      />
      {editable && (
        <Button size="sm" color="primary-destructive" onPress={onDelete}>
          {f.delete}
        </Button>
      )}
    </div>
  );
}
