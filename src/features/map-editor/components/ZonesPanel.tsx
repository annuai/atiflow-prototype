import { useSyncedState } from '@/hooks/use-synced-state';
import { ArrowLeft, ChevronDown, LayoutGrid01, Plus, Hand, Trash01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Dropdown } from '@/components/base/dropdown/dropdown';
import { Input } from '@/components/base/input/input';
import { Label } from '@/components/base/input/label';
import { Select } from '@/components/base/select/select';
import { EmptyState } from '@/components/data/EmptyState';
import { copy } from '../copy';
import { text } from '../text';
import { help } from '../help';
import type { MapData, MapZone, ZoneProp } from '../model/types';
import { zoneNameProblem } from '../model/zones';
import { zoneType, zoneTypesOf, type ZoneType } from '../model/zoneTypes';
import { ModuleList } from './ModuleList';
import { NumberInput } from './NumberInput';
import { LocateButton } from './LocateButton';

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
          ? `${z.props.shape === 'line' ? t.form.line : t.form.box} · ${z.props.capacity ?? 1} robot${(z.props.capacity ?? 1) === 1 ? '' : 's'}`
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
  onLocate,
  zone,
  data,
  module,
  editable,
  onBack,
  onPatch,
  onDelete,
}: {
  onLocate(): void;
  zone: MapZone;
  data: MapData;
  module: Module;
  editable: boolean;
  onBack(): void;
  onPatch(p: { name?: string; type?: string; props?: Record<string, ZoneProp> }): void;
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
        {zone.props.shape && (
          <Badge size="md" color="gray">
            {zone.props.shape === 'line' ? f.line : f.box}
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
      <Input
        label={f.corners}
        {...help('zone.corners')}
        size="sm"
        value={text.points(zone.polygon.length)}
        isDisabled
      />
      <div className="mt-auto flex flex-col gap-2">
        <LocateButton onPress={onLocate} />
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
