import { LayoutGrid01, MarkerPin02, Plus } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { EmptyState } from '@/components/data/EmptyState';
import { cx } from '@/utils/cx';
import { copy } from '../copy';
import { totalCells } from '../model/staging';
import { stationColor, stationTypeLabel } from '../model/stations';
import type { MapData } from '../model/types';
import { ModuleList } from './ModuleList';

export type StationsSub = 'stations' | 'staging';
/** The Stations module's panel (Figma "Right Panel Strip"): Stations | Staging areas, the create button, search and the list. Choosing one opens its form in the same place. */
export function StationsPanel({
  data,
  editable,
  adding,
  sub,
  onSub,
  selectedId,
  onSelect,
  onAdd,
  onCancelAdd,
}: {
  data: MapData;
  editable: boolean;
  adding: boolean;
  sub: StationsSub;
  onSub(s: StationsSub): void;
  selectedId: string | null;
  onSelect(id: string): void;
  onAdd(): void;
  onCancelAdd(): void;
}) {
  const t = copy.stations;
  const unplaced = data.stations.filter((s) => s.unplaced).length;
  const items =
    sub === 'stations'
      ? [...data.stations]
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
          .map((s) => ({
            id: s.id,
            title: s.name,
            subtitle: `${s.id} · ${stationTypeLabel(s.type)}${s.unplaced ? ` · ${t.needsPlacement}` : ''}`,
            dot: stationColor(s.type),
          }))
      : [...data.stagingAreas]
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
          .map((a) => ({
            id: a.id,
            title: a.name,
            subtitle: `${a.id} · ${a.rows} × ${a.cols} · ${copy.staging.form.cells(totalCells(a))}`,
            dot: '#38bdf8',
          }));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-5 border-b border-secondary px-4 pt-1" role="tablist" aria-label="Stations panel">
        {(
          [
            ['stations', t.tabStations],
            ['staging', t.tabStaging],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={sub === id}
            onClick={() => onSub(id)}
            className={cx(
              '-mb-px border-b-2 py-3 text-sm font-medium',
              sub === id ? 'border-brand text-brand-secondary' : 'border-transparent text-tertiary',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <ModuleList
        items={items}
        selectedId={selectedId}
        onSelect={onSelect}
        label={sub === 'stations' ? t.title : t.tabStaging}
        searchPlaceholder={sub === 'stations' ? t.search : copy.staging.search}
        noMatch={sub === 'stations' ? t.noMatch : copy.staging.noMatch}
        empty={
          sub === 'stations' ? (
            <EmptyState icon={MarkerPin02} title={t.none} subtext={t.noneHint} size="sm" />
          ) : (
            <EmptyState icon={LayoutGrid01} title={copy.staging.none} subtext={copy.staging.noneHint} size="sm" />
          )
        }
        controls={
          <>
            <div className="flex gap-2">
              <Button
                size="sm"
                color={adding ? 'primary' : 'secondary'}
                iconLeading={Plus}
                isDisabled={!editable}
                className="flex-1"
                onPress={adding ? onCancelAdd : onAdd}
              >
                {adding ? t.cancelAdd : sub === 'stations' ? t.add : copy.staging.add}
              </Button>
              {sub === 'stations' && (
                <Button size="sm" color="tertiary" isDisabled aria-label={`${t.upload}: ${t.uploadSoon}`}>
                  {t.upload}
                </Button>
              )}
            </div>
            {adding && (
              <p className="rounded-lg bg-brand-secondary px-3 py-2 text-xs text-brand-secondary">
                {sub === 'stations' ? t.adding : copy.hint.staging}
              </p>
            )}
            {sub === 'stations' && unplaced > 0 && (
              <p className="rounded-lg bg-warning-primary px-3 py-2 text-xs text-warning-primary">
                {t.needsPlacementCount(unplaced)}
              </p>
            )}
            {!editable && <p className="text-xs text-tertiary">{t.readOnly}</p>}
          </>
        }
      />
    </div>
  );
}
