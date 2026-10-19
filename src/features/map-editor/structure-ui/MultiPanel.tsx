import { Button } from '@/components/base/buttons/button';
import { Select } from '@/components/base/select/select';
import { copy } from '../copy';
import { modelOf, updateElements } from '../model/structure/ops';
import type { MapData } from '../model/types';
import { ColorPicker } from './ColorPicker';

/** Several elements selected at once: one colour or section for all, delete them together, or clear the selection. */
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
  const m = modelOf(data);
  const mine = m.elements.filter((e) => ids.includes(e.id));
  const same = <K extends 'color' | 'section'>(k: K) =>
    mine.every((e) => e[k] === mine[0]?.[k]) ? mine[0]?.[k] : undefined;
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-primary">{t.multi.title(ids.length)}</h3>
        <Button size="sm" color="tertiary" onPress={onClear}>
          {t.multi.clear}
        </Button>
      </div>
      <p className="text-xs text-tertiary">{t.multi.hint}</p>
      <Select
        label={f.section}
        size="sm"
        isDisabled={!editable}
        selectedKey={same('section') ?? ''}
        onSelectionChange={(k) => edit((d) => updateElements(d, ids, { section: String(k) || undefined }))}
        items={[{ id: '', label: f.noSection }, ...m.sections.map((s) => ({ id: s.id, label: s.name }))]}
      >
        {(item) => <Select.Item {...item} />}
      </Select>
      <ColorPicker
        label={f.color}
        value={same('color')}
        inherit={f.noSection}
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
