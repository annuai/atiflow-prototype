import { useSyncedState } from '@/hooks/use-synced-state';
import { ArrowLeft, ChevronDown, FlipBackward, LayoutGrid01, Plus, Hand, Trash01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Dropdown } from '@/components/base/dropdown/dropdown';
import { Input } from '@/components/base/input/input';
import { Label } from '@/components/base/input/label';
import { Select } from '@/components/base/select/select';
import { EmptyState } from '@/components/data/EmptyState';
import { copy } from '../copy';
import { help } from '../help';
import { DEFAULT_DEPTH, MIN_SIZE, degrees, flipGate, radians } from '../model/shape';
import type { MapData, MapZone, ZoneProp, ZoneShape } from '../model/types';
import { zoneNameProblem } from '../model/zones';
import { zoneType, zoneTypesOf, type ZoneType } from '../model/zoneTypes';
import { ModuleList } from './ModuleList';
import { NumberInput } from './NumberInput';

type Module = 'exclusive' | 'zones';
/** The panel of the Traffic Gates and Zones modules: the "Add new gate / zone" menu (types come from the zone registry), search and the list of that module's zones. */
export function ZonesPanel({
  module,
  data,
  editable,
  onAdd,
  selectedId,
  onSelect,
}: {
  module: Module;
  data: MapData;
  editable: boolean;
  onAdd(choice: string): void;
  selectedId: string | null;
  onSelect(id: string): void;
}) {
  const types = zoneTypesOf(module);
  const t = copy.zones;
  const exclusive = module === 'exclusive';
  const zones = data.zones.filter((z) => zoneType(z.type).module === module);
  return (
    <ModuleList
      items={zones.map((z) => ({
        id: z.id,
        title: z.name,
        subtitle: exclusive
          ? `${z.shape.kind === 'gate' ? t.form.line : t.form.box} · ${z.props.capacity ?? 1} robot${(z.props.capacity ?? 1) === 1 ? '' : 's'}`
          : zoneType(z.type).label,
        dot: zoneType(z.type).color,
      }))}
      selectedId={selectedId}
      onSelect={onSelect}
      label={exclusive ? copy.tabs.exclusive : copy.tabs.zones}
      searchPlaceholder={t.search}
      noMatch={t.noMatch}
      empty={
        exclusive ? (
          <EmptyState icon={Hand} title={t.noneExclusive} subtext={t.noneExclusiveHint} size="sm" />
        ) : (
          <EmptyState icon={LayoutGrid01} title={t.noneZones} subtext={t.noneZonesHint} size="sm" />
        )
      }
      controls={
        <>
          <Dropdown.Root>
            <Button
              size="sm"
              color="secondary"
              iconLeading={Plus}
              iconTrailing={ChevronDown}
              isDisabled={!editable}
              className="w-full"
            >
              {exclusive ? t.addGate : t.addZone}
            </Button>
            <Dropdown.Popover placement="bottom start" className="max-h-80 w-64">
              <Dropdown.Menu onAction={(k) => onAdd(String(k))}>
                {exclusive ? (
                  <>
                    <Dropdown.Item id="line" label={t.gateLine} />
                    <Dropdown.Item id="box" label={t.gateBox} />
                  </>
                ) : (
                  types.map((z) => <Dropdown.Item key={z.id} id={z.id} label={z.label} />)
                )}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.Root>
          {!editable && <p className="text-xs text-tertiary">{copy.stations.readOnly}</p>}
        </>
      }
    />
  );
}

const asNumber = (v: ZoneProp | undefined, d = 0) => (typeof v === 'number' ? v : d);
/** One zone: name, type (zones), its settings from the registry, the shape of a gate; delete. */
export function ZoneForm({
  zone,
  data,
  module,
  editable,
  onBack,
  onPatch,
  onShape,
  onDelete,
}: {
  zone: MapZone;
  data: MapData;
  module: Module;
  editable: boolean;
  onBack(): void;
  onPatch(p: { name?: string; type?: string; props?: Record<string, ZoneProp> }): void;
  /** the shape was changed from the numbers (the handles on the map call the same edit) */
  onShape(shape: ZoneShape): void;
  onDelete(): void;
}) {
  const f = copy.zones.form;
  const t: ZoneType = zoneType(zone.type);
  const [name, setName] = useSyncedState(zone.name, zone.id);
  const problem = zoneNameProblem(data, zone.id, name);
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
          {zone.id}
        </Badge>
        <Badge size="md" color="brand">
          {t.label}
        </Badge>
        {zone.type === 'exclusive' && (
          <Badge size="md" color="gray">
            {zone.shape.kind === 'gate' ? f.line : f.box}
          </Badge>
        )}
      </div>
      <Input
        label={f.name}
        size="sm"
        value={name}
        isDisabled={!editable}
        isInvalid={!!problem && editable}
        hint={editable ? problem || undefined : undefined}
        onChange={setName}
        onBlur={() => {
          if (editable && !problem && name.trim() !== zone.name) onPatch({ name: name.trim() });
          else setName(zone.name);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      {module === 'zones' && (
        <div className="flex flex-col gap-1.5">
          <Label {...help('zone.type')}>{f.type}</Label>
          <Select
            size="sm"
            aria-label={f.type}
            isDisabled={!editable}
            selectedKey={zone.type}
            onSelectionChange={(k) => onPatch({ type: String(k) })}
            items={zoneTypesOf('zones').map((z) => ({ id: z.id, label: z.label }))}
          >
            {(item) => <Select.Item {...item} />}
          </Select>
        </div>
      )}
      {t.fields.map((fd) =>
        fd.kind === 'number' ? (
          <NumberInput
            key={fd.key}
            {...help(`zone.field.${fd.key}`)}
            label={fd.unit ? `${fd.label} (${fd.unit})` : fd.label}
            value={asNumber(zone.props[fd.key], asNumber(fd.default))}
            disabled={!editable}
            onCommit={(v) => onPatch({ props: { [fd.key]: v } })}
          />
        ) : fd.kind === 'boolean' ? (
          <Checkbox
            key={fd.key}
            size="sm"
            label={fd.label}
            isDisabled={!editable}
            isSelected={!!zone.props[fd.key]}
            onChange={(v) => onPatch({ props: { [fd.key]: v } })}
          />
        ) : (
          <Input
            key={fd.key}
            label={fd.label}
            {...help(`zone.field.${fd.key}`)}
            size="sm"
            value={String(zone.props[fd.key] ?? '')}
            isDisabled={!editable}
            onChange={(v) => onPatch({ props: { [fd.key]: v } })}
          />
        ),
      )}
      <ShapeFields shape={zone.shape} editable={editable} onShape={onShape} />
      <div className="mt-auto flex flex-col gap-2">
        {!editable ? (
          <p className="text-xs text-tertiary">{copy.stations.readOnly}</p>
        ) : (
          <Button size="md" color="secondary-destructive" iconLeading={Trash01} onPress={onDelete}>
            {f.delete}
          </Button>
        )}
      </div>
    </div>
  );
}

/** The numbers of a zone's shape: centre, size and rotation of a rectangle; start, end, depth and direction of a Line gate. They edit the same shape the handles on the map do. */
function ShapeFields({
  shape,
  editable,
  onShape,
}: {
  shape: ZoneShape;
  editable: boolean;
  onShape(s: ZoneShape): void;
}) {
  const f = copy.zones.form;
  const num = (label: string, tip: string, value: number, commit: (v: number) => void) => (
    <NumberInput {...help(tip)} label={label} value={value} disabled={!editable} onCommit={commit} />
  );
  if (shape.kind === 'gate') {
    const g = shape;
    const set = (patch: Partial<typeof g>) => onShape({ ...g, ...patch });
    return (
      <>
        <div className="grid grid-cols-2 gap-3">
          {num(f.startX, 'zone.centre', g.a[0], (v) => set({ a: [v, g.a[1]] }))}
          {num(f.startY, 'zone.centre', g.a[1], (v) => set({ a: [g.a[0], v] }))}
          {num(f.endX, 'zone.centre', g.b[0], (v) => set({ b: [v, g.b[1]] }))}
          {num(f.endY, 'zone.centre', g.b[1], (v) => set({ b: [g.b[0], v] }))}
        </div>
        {num(f.depth, 'zone.depth', g.depth, (v) => set({ depth: Math.max(MIN_SIZE, v) || DEFAULT_DEPTH }))}
        <div className="flex flex-col gap-1.5">
          <Label {...help('zone.direction')}>{f.direction}</Label>
          <Button
            size="sm"
            color="secondary"
            iconLeading={FlipBackward}
            isDisabled={!editable}
            onPress={() => onShape(flipGate(g))}
          >
            {f.flip}
          </Button>
        </div>
      </>
    );
  }
  const r = shape;
  const set = (patch: Partial<typeof r>) => onShape({ ...r, ...patch });
  return (
    <div className="grid grid-cols-2 gap-3">
      {num(f.centreX, 'zone.centre', r.cx, (v) => set({ cx: v }))}
      {num(f.centreY, 'zone.centre', r.cy, (v) => set({ cy: v }))}
      {num(f.width, 'zone.size', r.w, (v) => set({ w: Math.max(MIN_SIZE, v) }))}
      {num(f.height, 'zone.size', r.h, (v) => set({ h: Math.max(MIN_SIZE, v) }))}
      {num(f.rotation, 'zone.rotation', degrees(r.rot), (v) => set({ rot: radians(v) }))}
    </div>
  );
}
