import { ChevronRight, Route, SwitchVertical01 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { Select } from '@/components/base/select/select';
import { EmptyState } from '@/components/data/EmptyState';
import type { RobotType } from '@/data/robotTypes';
import { StationMap, stationLabel } from '@/features/workflow-builder';
import { copy } from '../copy';

type Stations = Parameters<typeof stationLabel>[0][];
type MapData =
  React.ComponentProps<typeof StationMap> extends infer P
    ? P extends { site: infer S; nav: infer N }
      ? { site: S; nav: N }
      : never
    : never;

/**
 * Step 2 of a custom trip: the chosen robot (tap to change it), the start and end station from two lists or by tapping the map, and the button that opens the confirmation.
 * In landscape the details are a column on the left and the map fills the rest.
 */
export function StationsStep({
  robot,
  map,
  stations,
  from,
  to,
  pickStep,
  error,
  summary,
  onChangeRobot,
  onFrom,
  onTo,
  onSwap,
  onPick,
  onSubmit,
}: {
  robot: RobotType | undefined;
  map: MapData | null;
  stations: Stations;
  from: string;
  to: string;
  pickStep: 'start' | 'end' | 'done';
  error: string | null;
  summary: string;
  onChangeRobot(): void;
  onFrom(id: string): void;
  onTo(id: string): void;
  onSwap(): void;
  onPick(id: string): void;
  onSubmit(): void;
}) {
  const options = stations.map((s) => ({ id: s.id, label: stationLabel(s) }));
  return (
    <section
      aria-label="Stations"
      className="grid shrink-0 gap-5 landscape:md:min-h-0 landscape:md:flex-1 landscape:md:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]"
    >
      <div className="flex min-w-0 flex-col gap-4 landscape:md:min-h-0 landscape:md:overflow-y-auto">
        {robot && (
          <button
            type="button"
            onClick={onChangeRobot}
            aria-label={`${copy.book.changeRobot}: ${robot.label}`}
            className="flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl border border-secondary bg-primary p-2 pr-4 text-left outline-focus-ring transition hover:bg-primary_hover focus-visible:outline-2"
          >
            <span className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary p-1">
              <img
                src={robot.illustration}
                alt=""
                className="size-full object-contain"
                loading="lazy"
                decoding="async"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-md font-semibold text-primary">{robot.label}</span>
              <span className="block text-sm text-tertiary">{copy.book.changeRobotHint}</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-fg-quaternary" aria-hidden />
          </button>
        )}
        <h2 className="text-lg font-semibold text-primary">{copy.book.stationsHint}</h2>
        {!map ? (
          <p className="text-sm text-tertiary">{copy.book.loading}</p>
        ) : !stations.length ? (
          <EmptyState icon={Route} title={copy.book.noStations} subtext={copy.book.noStationsHint} size="md" />
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <Select
                label={copy.book.start}
                placeholder={copy.book.pick}
                size="md"
                selectedKey={from || null}
                onSelectionChange={(k) => onFrom(String(k))}
                items={options}
              >
                {(item) => <Select.Item {...item} />}
              </Select>
              <Select
                label={copy.book.end}
                placeholder={copy.book.pick}
                size="md"
                selectedKey={to || null}
                onSelectionChange={(k) => onTo(String(k))}
                items={options}
              >
                {(item) => <Select.Item {...item} />}
              </Select>
            </div>
            <ButtonUtility
              size="sm"
              color="secondary"
              icon={SwitchVertical01}
              tooltip={copy.book.swap}
              aria-label={copy.book.swap}
              isDisabled={!from && !to}
              onPress={onSwap}
              className="shrink-0"
            />
          </div>
        )}
        <p className="text-sm font-medium text-secondary" aria-live="polite">
          {copy.book.mapHint(pickStep)}
        </p>
        <div className="mt-auto flex flex-col gap-2 border-t border-secondary pt-4">
          <Button size="xl" color="primary" isDisabled={!!error} onPress={onSubmit}>
            {copy.book.submit}
          </Button>
          <p className="text-sm text-tertiary">{error ? error : summary}</p>
        </div>
      </div>
      <div className="relative h-[56vh] min-h-[320px] overflow-hidden rounded-xl border border-secondary landscape:md:h-full landscape:md:min-h-0">
        {map && stations.length > 0 && (
          <StationMap
            site={map.site}
            nav={map.nav}
            usable={new Set(stations.map((s) => s.id))}
            highlighted={[from, to].filter(Boolean)}
            pickable
            onPick={onPick}
          />
        )}
      </div>
    </section>
  );
}
