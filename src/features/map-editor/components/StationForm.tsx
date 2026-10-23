import { useSyncedState } from '@/hooks/use-synced-state';
import { ArrowLeft, Route, Trash01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { Label } from '@/components/base/input/label';
import { RadioButton, RadioGroup } from '@/components/base/radio-buttons/radio-buttons';
import { Select } from '@/components/base/select/select';
import type { StationType } from '@/core/types';
import { copy } from '../copy';
import { help } from '../help';
import { nameProblem, plainType, STATION_TYPES } from '../model/stations';
import type { MapData, MapStation } from '../model/types';
import { NumberInput } from './NumberInput';
import { FeaturesSection } from './approach/FeaturesSection';
import { NodesSection } from './approach/NodesSection';

/** One station (Figma "Add v5 Station"): name, id, type, position, angle, on / off lane, the tag; delete. Read-only when the map is a published version. */
export function StationForm({
  station,
  data,
  at,
  usedBy,
  editable,
  onBack,
  onPatch,
  onMove,
  onPlace,
  onEdit,
  addingNode,
  onAddNode,
  onCancelAddNode,
  onRouteFrom,
  onDelete,
}: {
  station: MapStation;
  data: MapData;
  at: { x: number; y: number };
  usedBy: string[];
  editable: boolean;
  onBack(): void;
  onPatch(p: Partial<Pick<MapStation, 'name' | 'type' | 'angle' | 'onLane' | 'features'>>): void;
  /** change the draft (nodes and their roles) */
  onEdit(fn: (m: MapData) => MapData, key?: string): void;
  /** the tool that adds a node is armed for this station */
  addingNode: boolean;
  onAddNode(): void;
  onCancelAddNode(): void;
  onMove(to: { x: number; y: number }): void;
  /** arm the place tool: the next click on the map gives this station its position */
  onPlace(): void;
  /** point-to-point (v2) maps: start a route here */
  onRouteFrom(): void;
  onDelete(): void;
}) {
  const f = copy.stations.form;
  const [name, setName] = useSyncedState(station.name, station.id);
  const problem = nameProblem(data, station.id, name);
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
          {station.id}
        </Badge>
      </div>
      {station.unplaced && (
        <div
          className="flex flex-col gap-2 rounded-lg bg-warning-primary p-3 text-sm text-warning-primary"
          role="status"
        >
          {f.placeNote}
          {editable && (
            <Button size="sm" color="secondary" className="w-fit" onPress={onPlace}>
              {f.placeButton}
            </Button>
          )}
        </div>
      )}
      <Input
        label={f.name}
        size="sm"
        value={name}
        isDisabled={!editable}
        isInvalid={!!problem && editable}
        hint={editable ? problem || undefined : undefined}
        onChange={setName}
        onBlur={() => {
          if (editable && !problem && name.trim() !== station.name) onPatch({ name: name.trim() });
          else setName(station.name);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <Input label={f.id} {...help('station.id')} size="sm" value={station.id} isDisabled />
      <div className="flex flex-col gap-1.5">
        <Label {...help('station.type')}>{f.type}</Label>
        <Select
          size="sm"
          aria-label={f.type}
          isDisabled={!editable}
          selectedKey={plainType(station.type)}
          onSelectionChange={(k) => onPatch({ type: String(k) as StationType })}
          items={STATION_TYPES.map((t) => ({ id: t.id, label: t.label }))}
        >
          {(item) => <Select.Item {...item} />}
        </Select>
      </div>
      {!data.p2p && (
        <div className="flex flex-col gap-2">
          <Label {...help('station.placement')}>{f.orientation}</Label>
          <RadioGroup
            aria-label={f.orientation}
            isDisabled={!editable}
            value={station.onLane === false ? 'off' : 'on'}
            onChange={(v) => onPatch({ onLane: v === 'on' })}
            className="flex-row gap-6"
          >
            <RadioButton value="off" label={f.offLane} />
            <RadioButton value="on" label={f.onLane} />
          </RadioGroup>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <NumberInput
          {...help('station.x')}
          label={f.x}
          value={at.x}
          disabled={!editable}
          onCommit={(x) => onMove({ x, y: at.y })}
        />
        <NumberInput
          {...help('station.y')}
          label={f.y}
          value={at.y}
          disabled={!editable}
          onCommit={(y) => onMove({ x: at.x, y })}
        />
      </div>
      <NumberInput
        {...help('station.angle')}
        label={f.angle}
        value={station.angle ?? 0}
        disabled={!editable}
        onCommit={(angle) => onPatch({ angle })}
      />
      {!data.p2p && (
        <>
          {station.onLane === false && (
            <NodesSection
              station={station}
              data={data}
              editable={editable}
              adding={addingNode}
              onEdit={onEdit}
              onAdd={onAddNode}
              onCancelAdd={onCancelAddNode}
            />
          )}
          <FeaturesSection station={station} editable={editable} onChange={(features) => onPatch({ features })} />
        </>
      )}
      {usedBy.length > 0 && (
        <p className="rounded-lg bg-warning-secondary px-3 py-2 text-xs text-secondary">
          {f.usedBy(usedBy.length, usedBy.join(', '))}
        </p>
      )}
      <div className="mt-auto flex flex-col gap-2">
        {data.p2p && editable && (
          <Button size="md" color="secondary" iconLeading={Route} onPress={onRouteFrom}>
            {f.addRoute}
          </Button>
        )}
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
