import { Grid01 } from '@untitledui/icons';
import { EmptyState } from '@/components/data/EmptyState';
import { useEffect, useMemo, useState } from 'react';
import { useFleetOptions } from '@/features/auth';
import { useFleets } from '@/features/fleets';
import { useMaps } from '@/features/maps';
import { seedMapData, mapVersionsStore, useMapVersions } from '@/features/map-editor';
import { useMapData } from '@/features/workflow-builder';
import { Badge, BadgeWithDot } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { Tooltip, TooltipTrigger } from '@/components/base/tooltip/tooltip';
import { Select } from '@/components/base/select/select';
import { useAuth } from '@/features/auth';
import { ButtonGroup, ButtonGroupItem } from '@/components/base/button-group/button-group';
import { ProgressBar } from '@/components/base/progress-indicators/progress-indicators';
import { cx } from '@/utils/cx';
import { copy } from '../copy';
import { totalCells, utilised } from '../model/areas';
import { pickOrder, stockOf } from '../model/cells';
import { CELL_STATES } from '../model/cellStates';
import { areasByFleet } from '../model/mapAreas';
import { useMasterData } from '../model/store';
import type { StagingArea } from '../model/types';
import { CellEditor } from './CellEditor';
import { CellGrid } from './CellGrid';

type Mode = 'view' | 'manage';
const ALL = '__all';

function AreaCard({ area, selected, onSelect }: { area: StagingArea; selected: boolean; onSelect(): void }) {
  const used = utilised(area),
    total = totalCells(area);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cx(
        'flex w-full cursor-pointer flex-col gap-3 rounded-xl border bg-primary p-5 text-left shadow-xs outline-focus-ring transition focus-visible:outline-2',
        selected ? 'border-2 border-brand' : 'border-secondary hover:bg-primary_hover',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-md font-semibold text-primary">{area.name}</span>
        <Badge size="sm" type="pill-color" color="gray">
          {area.retrieval === 'lifo' ? copy.staging.retrieval.lifo : copy.staging.retrieval.fifo}
        </Badge>
      </span>
      <span className="flex items-center justify-between text-sm text-tertiary">
        <span>{copy.staging.cardUtilisation}</span>
        <span className="font-semibold text-primary">
          {used}/{total}
        </span>
      </span>
      <ProgressBar value={used} max={total} valueFormatter={() => ''} ariaLabel={`${area.name} utilisation`} />
    </button>
  );
}

/** Staging Area tab: area cards (utilisation) + the selected area's cell grid with View / Manage and a legend. */
export function StagingAreaPanel() {
  const stored = useMasterData((s) => s.areas);
  const fleets = useFleetOptions();
  const profiles = useFleets((s) => s.profiles);
  const maps = useMaps();
  const byMap = useMapVersions((s) => s.byMap);
  const base = useMapData();
  const [selectedId, setSelected] = useState<string>('');
  const [mode, setMode] = useState<Mode>('view');
  const materials = useMasterData((s) => s.materials);
  const user = useAuth((s) => s.user);
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = useState<string[] | null>(null);
  const [filterCode, setFilterCode] = useState('');
  const names = useMemo(() => new Map(materials.map((m) => [m.code, m.name])), [materials]);
  // a map that was never opened in the editor gets its first published version from the real site (once)
  useEffect(() => {
    if (base)
      for (const m of maps) mapVersionsStore.getState().ensure(m.id, m.version, seedMapData(m, base.site, base.nav));
  }, [maps, base]);
  const groups = useMemo(
    () =>
      areasByFleet(
        fleets.map((f) => f.label),
        (f) => profiles[f]?.mapId ?? null,
        (id) => maps.find((m) => m.id === id)?.name ?? id,
        byMap,
        (id) => stored.find((a) => a.id === id),
      ).filter((g) => g.areas.length),
    [fleets, profiles, maps, byMap, stored],
  );
  const areas = groups.flatMap((g) => g.areas);
  const area = areas.find((a) => a.id === selectedId) ?? areas[0];
  const fleetOfArea = groups.find((g) => g.areas.some((a) => a.id === area?.id))?.fleet ?? '';
  if (!area)
    return <EmptyState icon={Grid01} title={copy.emptyTitles.staging} subtext={copy.staging.empty} size="lg" />;
  const stock = stockOf(area);
  const stocked = Object.keys(stock).sort();
  const focus = filterCode ? { code: filterCode, order: pickOrder(area, filterCode) } : null;
  const hint = area.retrieval === 'lifo' ? copy.staging.retrieval.lifoHint : copy.staging.retrieval.fifoHint;
  return (
    <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="flex flex-col gap-4 overflow-y-auto">
        {groups.map((g) => (
          <div key={g.fleet} className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-secondary">
              {g.fleet}{' '}
              <span className="font-normal text-tertiary">
                · {g.mapName} v{g.version}
              </span>
            </p>
            {g.areas.map((a) => (
              <AreaCard
                key={a.id}
                area={a}
                selected={a.id === area.id}
                onSelect={() => {
                  setSelected(a.id);
                  setSelection(new Set());
                  setFilterCode('');
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <section
        className="flex min-h-0 flex-col rounded-xl border border-secondary bg-primary"
        aria-label={copy.staging.layoutTitle(area.name)}
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-md font-semibold text-primary">{copy.staging.layoutTitle(area.name)}</h2>
            <Badge size="sm" type="pill-color" color="brand">
              {copy.staging.selected}
            </Badge>
            <Tooltip title={copy.staging.retrieval.label} description={hint}>
              <TooltipTrigger>
                <Badge size="sm" type="pill-color" color="gray">
                  {copy.staging.retrieval.label}:{' '}
                  {area.retrieval === 'lifo' ? copy.staging.retrieval.lifo : copy.staging.retrieval.fifo}
                </Badge>
              </TooltipTrigger>
            </Tooltip>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {stocked.length > 0 && (
              <Select
                size="sm"
                aria-label={copy.staging.filter.label}
                className="w-56"
                selectedKey={filterCode || ALL}
                onSelectionChange={(k) => setFilterCode(k === ALL ? '' : String(k))}
                items={[
                  { id: ALL, label: copy.staging.filter.all },
                  ...stocked.map((c) => ({ id: c, label: names.get(c) ? `${c} · ${names.get(c)}` : c })),
                ]}
              >
                {(item) => <Select.Item {...item} />}
              </Select>
            )}
            <ButtonGroup
              size="sm"
              selectedKeys={[mode]}
              onSelectionChange={(k) => {
                const v = [...k][0];
                if (v) {
                  setMode(v as Mode);
                  setSelection(new Set());
                }
              }}
            >
              {(Object.keys(copy.staging.modes) as Mode[]).map((m) => (
                <ButtonGroupItem key={m} id={m}>
                  {copy.staging.modes[m]}
                </ButtonGroupItem>
              ))}
            </ButtonGroup>
          </div>
        </header>
        {filterCode && (
          <p className="border-b border-secondary px-5 py-2 text-sm text-secondary">
            {focus && focus.order.length
              ? copy.staging.filter.stored(filterCode, focus.order.length, stock[filterCode] ?? 0)
              : copy.staging.filter.none(filterCode)}
          </p>
        )}
        {mode === 'manage' && selection.size > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary bg-secondary px-5 py-2">
            <span className="text-sm font-medium text-primary">{copy.staging.bulk.selected(selection.size)}</span>
            <div className="flex gap-2">
              <Button size="sm" color="secondary" onPress={() => setSelection(new Set())}>
                {copy.staging.bulk.clear}
              </Button>
              <Button size="sm" color="primary" onPress={() => setEditing([...selection])}>
                {copy.staging.bulk.edit}
              </Button>
            </div>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto">
          <CellGrid
            area={area}
            names={names}
            selected={selection}
            focus={focus}
            onCell={(key, additive) => {
              if (mode === 'manage' && additive)
                setSelection((cur) => {
                  const next = new Set(cur);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                });
              else {
                setSelection(new Set());
                setEditing([key]);
              }
            }}
          />
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-secondary px-5 py-3">
          <p className="text-xs text-tertiary">{mode === 'manage' ? copy.staging.manageHint : copy.staging.viewHint}</p>
          <div className="flex flex-wrap gap-2">
            {CELL_STATES.map((s) => (
              <BadgeWithDot key={s.id} size="sm" type="pill-color" color={s.badge}>
                {s.label}
              </BadgeWithDot>
            ))}
          </div>
        </footer>
        {editing && user && (
          <CellEditor
            key={editing.join(',')}
            area={area}
            keys={editing}
            manage={mode === 'manage'}
            by={user.username}
            allowed={materials.filter((m) => m.fleets.includes(fleetOfArea))}
            names={names}
            onClose={() => setEditing(null)}
          />
        )}
      </section>
    </div>
  );
}
