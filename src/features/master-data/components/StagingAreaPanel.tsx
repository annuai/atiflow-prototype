import { Grid01 } from '@untitledui/icons';
import { EmptyState } from '@/components/data/EmptyState';
import { useEffect, useMemo, useState } from 'react';
import { useFleetOptions } from '@/features/auth';
import { useFleets } from '@/features/fleets';
import { useMaps } from '@/features/maps';
import { seedMapData, mapVersionsStore, useMapVersions } from '@/features/map-editor';
import { useMapData } from '@/features/workflow-builder';
import { Badge, BadgeWithDot } from '@/components/base/badges/badges';
import { ButtonGroup, ButtonGroupItem } from '@/components/base/button-group/button-group';
import { ProgressBar } from '@/components/base/progress-indicators/progress-indicators';
import { cx } from '@/utils/cx';
import { copy } from '../copy';
import { totalCells, utilised } from '../model/areas';
import { CELL_STATES } from '../model/cellStates';
import { areasByFleet } from '../model/mapAreas';
import { masterDataStore, useMasterData } from '../model/store';
import type { StagingArea } from '../model/types';
import { CellGrid } from './CellGrid';

type Mode = 'view' | 'manage';

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
      <span className="text-md font-semibold text-primary">{area.name}</span>
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
        (id) => stored.find((a) => a.id === id)?.cells ?? {},
      ).filter((g) => g.areas.length),
    [fleets, profiles, maps, byMap, stored],
  );
  const areas = groups.flatMap((g) => g.areas);
  const area = areas.find((a) => a.id === selectedId) ?? areas[0];
  if (!area)
    return <EmptyState icon={Grid01} title={copy.emptyTitles.staging} subtext={copy.staging.empty} size="lg" />;
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
              <AreaCard key={a.id} area={a} selected={a.id === area.id} onSelect={() => setSelected(a.id)} />
            ))}
          </div>
        ))}
      </div>
      <section
        className="flex min-h-0 flex-col rounded-xl border border-secondary bg-primary"
        aria-label={copy.staging.layoutTitle(area.name)}
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-md font-semibold text-primary">{copy.staging.layoutTitle(area.name)}</h2>
            <Badge size="sm" type="pill-color" color="brand">
              {copy.staging.selected}
            </Badge>
          </div>
          <ButtonGroup
            size="sm"
            selectedKeys={[mode]}
            onSelectionChange={(k) => {
              const v = [...k][0];
              if (v) setMode(v as Mode);
            }}
          >
            {(Object.keys(copy.staging.modes) as Mode[]).map((m) => (
              <ButtonGroupItem key={m} id={m}>
                {copy.staging.modes[m]}
              </ButtonGroupItem>
            ))}
          </ButtonGroup>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <CellGrid
            area={area}
            manage={mode === 'manage'}
            onToggle={(r, c) => masterDataStore.getState().toggleCell(area, r, c)}
          />
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-secondary px-5 py-3">
          <p className="text-xs text-tertiary">{mode === 'manage' ? copy.staging.manageHint : ''}</p>
          <div className="flex flex-wrap gap-2">
            {CELL_STATES.map((s) => (
              <BadgeWithDot key={s.id} size="sm" type="pill-color" color={s.badge}>
                {s.label}
              </BadgeWithDot>
            ))}
          </div>
        </footer>
      </section>
    </div>
  );
}
