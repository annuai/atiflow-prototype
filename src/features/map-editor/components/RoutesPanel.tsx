import { useEffect, useState } from 'react';
import { ArrowLeft, Route, SwitchVertical01, Trash01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Select } from '@/components/base/select/select';
import { Input } from '@/components/base/input/input';
import { EmptyState } from '@/components/data/EmptyState';
import { copy } from '../copy';
import { help, helpText } from '../help';
import { nameProblem, roadAngle, roadLength, type RoadPatch } from '../model/roads';
import type { MapData, MapRoad, RoadHeading } from '../model/types';
import { LocateButton } from './LocateButton';
import { Hint } from './Hint';
import { ModuleList } from './ModuleList';
import { NumberInput } from './NumberInput';

const HEADINGS: RoadHeading[] = ['both', 'forward', 'backward'];

/** The Routes module's panel: draw a road (the tool is already on when the module opens), the one-way option, search and the list of roads. */
export function RoutesPanel({
  data,
  editable,
  drawing,
  onDraw,
  onStop,
  selectedId,
  onSelect,
}: {
  data: MapData;
  editable: boolean;
  drawing: boolean;
  onDraw(): void;
  onStop(): void;
  selectedId: string | null;
  onSelect(id: string): void;
}) {
  const t = copy.routes;
  return (
    <ModuleList
      items={[...data.roads]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        .map((r) => ({
          id: r.id,
          title: r.name,
          subtitle: `${r.oneWay ? 'One-way' : 'Two lanes'} · ${roadLength(r)} m`,
          icon: <Route className="size-4 shrink-0 text-fg-brand-primary" />,
        }))}
      selectedId={selectedId}
      onSelect={onSelect}
      label={t.title}
      searchPlaceholder={t.search}
      noMatch={t.noMatch}
      empty={<EmptyState icon={Route} title={t.none} subtext={t.noneHint} size="sm" />}
      controls={
        <>
          <Button
            size="sm"
            color={drawing ? 'primary' : 'secondary'}
            iconLeading={Route}
            isDisabled={!editable}
            onPress={drawing ? onStop : onDraw}
          >
            {drawing ? t.drawing : t.draw}
          </Button>
          {!editable && <p className="text-xs text-tertiary">{copy.stations.readOnly}</p>}
        </>
      }
    />
  );
}

/** One road: name, where it starts and ends, its direction (swap), one lane or two, the heading setting; length and lanes; delete. (No lane weight yet: it will set a lane's priority once priorities exist.) */
export function RoadForm({
  onLocate,
  road,
  data,
  editable,
  onBack,
  onRename,
  onPatch,
  onDelete,
}: {
  onLocate(): void;
  road: MapRoad;
  data: MapData;
  editable: boolean;
  onBack(): void;
  onRename(name: string): void;
  onPatch(p: RoadPatch): void;
  onDelete(): void;
}) {
  const f = copy.routes.form;
  const [name, setName] = useState(road.name);
  useEffect(() => setName(road.name), [road.id, road.name]);
  const problem = nameProblem(data, road.id, name);
  const a = road.points[0],
    b = road.points[road.points.length - 1];
  const move = (end: 'a' | 'b', i: 0 | 1, v: number) => {
    const pts = road.points.map((p) => [...p] as [number, number]);
    const k = end === 'a' ? 0 : pts.length - 1;
    pts[k][i] = v;
    onPatch({ points: pts });
  };
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
        <Badge size="md" color={road.oneWay ? 'warning' : 'success'}>
          {road.oneWay ? f.oneWay : f.twoWay}
        </Badge>
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
          if (editable && !problem && name.trim() !== road.name) onRename(name.trim());
          else setName(road.name);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberInput
          label={f.startX}
          {...help('route.start')}
          value={a[0]}
          disabled={!editable}
          onCommit={(v) => move('a', 0, v)}
        />
        <NumberInput
          label={f.startY}
          {...help('route.start')}
          value={a[1]}
          disabled={!editable}
          onCommit={(v) => move('a', 1, v)}
        />
        <NumberInput
          label={f.endX}
          {...help('route.end')}
          value={b[0]}
          disabled={!editable}
          onCommit={(v) => move('b', 0, v)}
        />
        <NumberInput
          label={f.endY}
          {...help('route.end')}
          value={b[1]}
          disabled={!editable}
          onCommit={(v) => move('b', 1, v)}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-secondary">
          {f.angle(roadAngle(road))}
          <Hint k="route.angle" />
        </span>
        <ButtonUtility
          size="sm"
          color="secondary"
          icon={SwitchVertical01}
          tooltip={f.swap}
          aria-label={f.swap}
          isDisabled={!editable}
          onPress={() => onPatch({ swap: true })}
        />
      </div>
      <Checkbox
        size="sm"
        label={f.twoWayLane}
        hint={helpText('route.twoWay')}
        isDisabled={!editable}
        isSelected={!road.oneWay}
        onChange={(v) => onPatch({ oneWay: !v })}
      />
      <div className="flex flex-col gap-3 border-t border-secondary pt-4">
        <h3 className="text-sm font-semibold text-primary">{f.properties}</h3>
        <Select
          label={f.heading}
          {...help('route.heading')}
          size="sm"
          isDisabled={!editable}
          selectedKey={road.heading ?? 'both'}
          onSelectionChange={(k) => onPatch({ heading: String(k) as RoadHeading })}
          items={HEADINGS.map((h) => ({ id: h, label: f.headings[h] }))}
        >
          {(item) => <Select.Item {...item} />}
        </Select>
      </div>
      <Input label={f.length} {...help('route.length')} size="sm" value={`${roadLength(road)} m`} isDisabled />
      <Input label={f.lanes} {...help('route.lanes')} size="sm" value={road.laneIds.join(', ')} isDisabled />
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
