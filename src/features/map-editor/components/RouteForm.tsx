import { ArrowLeft, PlusCircle, SwitchVertical01, Trash01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Select } from '@/components/base/select/select';
import { copy } from '../copy';
import {
  addReverseRoute,
  deleteRouteNode,
  nodeRadius,
  routeEnds,
  routeNodes,
  setNodeRadius,
  setRouteEnds,
} from '../model/routes';
import { updateRoad } from '../model/roads';
import type { MapData, MapRoad } from '../model/types';
import { NumberInput } from './NumberInput';

/**
 * One route of a point-to-point (v2) map, the way the Deployment Manager shows it: the start and end station (and a swap), Reverse mode, and, when a bend node of the route is selected on
 * the map, its curve radius and a button to delete it. A route is always one-way: "Add reverse route" makes the one that goes back (a route of its own, bendable on its own).
 */
export function RouteForm({
  road,
  data,
  node,
  editable,
  onBack,
  onDelete,
  edit,
  onPick,
}: {
  road: MapRoad;
  data: MapData;
  /** index of the selected bend node, if any */
  node?: number;
  editable: boolean;
  onBack(): void;
  onDelete(): void;
  edit(fn: (m: MapData) => MapData): void;
  onPick(sel: { kind: 'road'; id: string; node?: number } | null): void;
}) {
  const f = copy.routes.form;
  const { from, to } = routeEnds(data, road);
  const stations = data.stations.map((s) => ({ id: s.id, label: s.name }));
  const nodes = routeNodes(road);
  const selected = node !== undefined && node < nodes.length ? node : undefined;
  const ends = (a: string, b: string) => edit((m) => setRouteEnds(m, road.id, a, b));
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
          {road.id}
        </Badge>
        <Badge size="md" color="warning">
          {f.oneWay}
        </Badge>
      </div>
      <p className="text-xs text-tertiary">{f.nodeTip}</p>
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-3">
          <Select
            label={f.startStation}
            size="sm"
            isDisabled={!editable}
            selectedKey={from?.id ?? null}
            onSelectionChange={(k) => to && ends(String(k), to.id)}
            items={stations}
          >
            {(item) => <Select.Item {...item} />}
          </Select>
          <Select
            label={f.endStation}
            size="sm"
            isDisabled={!editable}
            selectedKey={to?.id ?? null}
            onSelectionChange={(k) => from && ends(from.id, String(k))}
            items={stations}
          >
            {(item) => <Select.Item {...item} />}
          </Select>
        </div>
        <ButtonUtility
          size="sm"
          color="secondary"
          icon={SwitchVertical01}
          tooltip={f.swap}
          aria-label={f.swap}
          isDisabled={!editable || !from || !to}
          onPress={() => from && to && ends(to.id, from.id)}
        />
      </div>
      <Checkbox
        size="sm"
        label={f.reverseMode}
        isDisabled={!editable}
        isSelected={road.heading === 'backward'}
        onChange={(v) => edit((m) => updateRoad(m, road.id, { heading: v ? 'backward' : 'forward' }))}
      />
      {selected !== undefined && (
        <div className="flex flex-col gap-3 border-t border-secondary pt-4" data-testid="node-section">
          <h3 className="text-sm font-semibold text-primary">{f.node}</h3>
          <NumberInput
            label={f.curveRadius}
            hint={f.radiusHint}
            value={nodeRadius(road, selected)}
            disabled={!editable}
            onCommit={(v) => edit((m) => setNodeRadius(m, road.id, selected, v))}
          />
          {editable && (
            <Button
              size="md"
              color="secondary-destructive"
              iconLeading={Trash01}
              onPress={() => {
                edit((m) => deleteRouteNode(m, road.id, selected));
                onPick({ kind: 'road', id: road.id });
              }}
            >
              {f.deleteNode}
            </Button>
          )}
        </div>
      )}
      <div className="mt-auto flex flex-col gap-2">
        {editable && (
          <Button
            size="md"
            color="secondary"
            iconLeading={PlusCircle}
            onPress={() => {
              const r = addReverseRoute(data, road.id);
              if (!r.id) return;
              edit(() => r.data);
              onPick({ kind: 'road', id: r.id });
            }}
          >
            {f.addReverse}
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
