import { useSyncedState } from '@/hooks/use-synced-state';
import { ArrowLeft, Copy01, Trash01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { Select } from '@/components/base/select/select';
import { copy } from '../copy';
import { LocateButton } from '../components/LocateButton';
import { NumberInput } from '../components/NumberInput';
import { degrees, radians } from '../model/shape';
import { elementColor } from '../model/structure/derive';
import { duplicateElement, modelOf, updateElement } from '../model/structure/ops';
import type { StructureElement } from '../model/structure/types';
import type { MapData } from '../model/types';
import { ColorPicker } from './ColorPicker';

const num = (v: number) => (Number.isFinite(v) ? v : 0);

/**
 * One element of the structure: its type, name, section, colour (the preset palette, or "the section's"), height, where it starts above the floor, thickness (walls and partitions), the text
 * shown on top (machines, pillars, areas), opacity (glass) and its place: points of a line or outline are dragged on the map, blocks have x / y / width / depth / rotation here.
 */
export function ElementForm({
  element,
  data,
  editable,
  edit,
  onBack,
  onLocate,
  onPick,
  onDelete,
}: {
  element: StructureElement;
  data: MapData;
  editable: boolean;
  edit(fn: (d: MapData) => MapData, key?: string): void;
  onBack(): void;
  onLocate(): void;
  onPick(id: string): void;
  onDelete(): void;
}) {
  const f = copy.structure.form;
  const e = element;
  const patch = (p: Partial<StructureElement>, key?: string) => edit((m) => updateElement(m, e.id, p), key);
  const [name, setName] = useSyncedState(e.name ?? '', e.id);
  const sections = modelOf(data).sections;
  const box = e.kind === 'machine' || e.kind === 'pillar' ? e : null;
  const workArea = e.kind === 'area' && !!e.work;
  const line = e.kind === 'wall' || e.kind === 'partition' ? e : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <button
        type="button"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-tertiary hover:text-secondary"
        onClick={onBack}
      >
        <ArrowLeft className="size-4" />
        {f.back}
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <Badge size="md" color="gray">
          {copy.structure.tools[e.kind === 'area' && e.work ? 'work' : e.kind]}
        </Badge>
        <span className="size-3 rounded-full ring-1 ring-secondary" style={{ background: elementColor(data, e) }} />
        <span className="text-xs text-tertiary">{e.id}</span>
      </div>
      <Input
        label={f.name}
        size="sm"
        value={name}
        isDisabled={!editable}
        onChange={setName}
        onBlur={() => (name.trim() !== (e.name ?? '') ? patch({ name: name.trim() || undefined }) : undefined)}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
        }}
      />
      <Select
        label={f.section}
        size="sm"
        isDisabled={!editable}
        selectedKey={e.section ?? ''}
        onSelectionChange={(k) => patch({ section: String(k) || undefined })}
        items={[{ id: '', label: f.noSection }, ...sections.map((s) => ({ id: s.id, label: s.name }))]}
      >
        {(item) => <Select.Item {...item} />}
      </Select>
      <ColorPicker
        label={f.color}
        value={e.color}
        inherit={f.noSection}
        custom={f.customColor}
        disabled={!editable}
        onChange={(color) => patch({ color })}
      />
      <div className="grid grid-cols-2 gap-3">
        {!workArea && (
          <NumberInput
            label={e.kind === 'door' ? f.doorHeight : f.height}
            value={e.height}
            disabled={!editable}
            onCommit={(v) => patch({ height: Math.max(0, num(v)) })}
          />
        )}
        {e.kind !== 'door' && !workArea && (
          <NumberInput
            label={f.base}
            hint={f.baseHint}
            value={e.base ?? 0}
            disabled={!editable}
            onCommit={(v) => patch({ base: Math.max(0, num(v)) || undefined })}
          />
        )}
        {line && (
          <NumberInput
            label={f.thickness}
            value={line.thickness}
            disabled={!editable}
            onCommit={(v) => patch({ thickness: Math.max(0.05, num(v)) } as Partial<StructureElement>)}
          />
        )}
        {e.kind !== 'door' && (
          <NumberInput
            label={f.opacity}
            value={e.opacity ?? 1}
            disabled={!editable}
            onCommit={(v) =>
              patch({
                opacity: Math.max(0.1, Math.min(1, num(v))) === 1 ? undefined : Math.max(0.1, Math.min(1, num(v))),
              })
            }
          />
        )}
      </div>
      {(e.kind === 'machine' || e.kind === 'pillar' || e.kind === 'area') && (
        <Input
          label={f.label}
          size="sm"
          value={e.label ?? ''}
          isDisabled={!editable}
          onChange={(v) => patch({ label: v || undefined })}
        />
      )}
      {box && (
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label={f.x}
            value={box.x}
            disabled={!editable}
            onCommit={(x) => patch({ x } as Partial<StructureElement>, `box:${e.id}`)}
          />
          <NumberInput
            label={f.y}
            value={box.y}
            disabled={!editable}
            onCommit={(y) => patch({ y } as Partial<StructureElement>, `box:${e.id}`)}
          />
          <NumberInput
            label={f.width}
            value={box.w}
            disabled={!editable}
            onCommit={(w) => patch({ w: Math.max(0.1, w) } as Partial<StructureElement>, `box:${e.id}`)}
          />
          <NumberInput
            label={f.depth}
            value={box.d}
            disabled={!editable}
            onCommit={(d) => patch({ d: Math.max(0.1, d) } as Partial<StructureElement>, `box:${e.id}`)}
          />
          <NumberInput
            label={f.rotation}
            value={degrees(box.rot)}
            disabled={!editable}
            onCommit={(r) => patch({ rot: radians(r) } as Partial<StructureElement>, `box:${e.id}`)}
          />
        </div>
      )}
      {e.kind === 'door' && (
        <NumberInput
          label={f.doorWidth}
          value={e.w}
          disabled={!editable}
          onCommit={(w) => patch({ w: Math.max(0.3, w) } as Partial<StructureElement>)}
        />
      )}
      {'points' in e && <p className="text-xs text-tertiary">{f.points(e.points.length)}</p>}
      <div className="mt-auto flex flex-col gap-2">
        {editable && e.kind !== 'door' && (
          <Button
            size="md"
            color="secondary"
            iconLeading={Copy01}
            onPress={() => {
              const r = duplicateElement(data, e.id);
              if (!r.id) return;
              edit(() => r.data);
              onPick(r.id);
            }}
          >
            {f.duplicate}
          </Button>
        )}
        <LocateButton onPress={onLocate} />
        {editable && (
          <Button size="md" color="secondary-destructive" iconLeading={Trash01} onPress={onDelete}>
            {f.delete}
          </Button>
        )}
      </div>
    </div>
  );
}
