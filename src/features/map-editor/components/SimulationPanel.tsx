import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { ProgressBar } from '@/components/base/progress-indicators/progress-indicators';
import { Select } from '@/components/base/select/select';
import { EmptyState } from '@/components/data/EmptyState';
import { ROBOT_TYPES, robotTypeByLabel } from '@/data/robotTypes';
import { Route, SwitchVertical01 } from '@untitledui/icons';
import { copy } from '../copy';
import { copy as approach } from './approach/copy';
import { RouteCheckPanel } from './approach/RouteCheckPanel';
import type { MapData } from '../model/types';
import type { SimState } from '../sim/tripSim';

export interface SimChoice {
  type: string;
  start: string;
  end: string;
  /** the robot leaves the start station carrying a load (Laden) instead of empty (Unladen) */
  laden: boolean;
  /** the robot arrives at the end station to pick a load up (Pick) instead of putting one down (Drop) */
  pick: boolean;
}
/** The Simulation panel: pick the robot type FIRST, then the start and end station, then Simulate route. The robot drives the lanes of this map from one to the other. */
export function SimulationPanel({
  data,
  choice,
  onChoice,
  state,
  error,
  info,
  fleet,
  onRun,
  onStop,
}: {
  data: MapData;
  choice: SimChoice;
  onChoice(c: SimChoice): void;
  state: SimState;
  error: string;
  /** what the last run used: the nodes it went by and any maneuver the robot could not drive */
  info: string[];
  /** the lane-map fleet of the open map (routes are planned for it) */
  fleet: string;
  onRun(): void;
  onStop(): void;
}) {
  const t = copy.sim;
  const a = approach.sim;
  const running = state.status === 'running';
  const stations = [...data.stations]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((s) => ({ id: s.id, label: `${s.name} · ${s.id}` }));
  const set = (patch: Partial<SimChoice>) => onChoice({ ...choice, ...patch });
  if (!stations.length)
    return <EmptyState icon={Route} title={t.noStations} subtext={t.noStationsHint} size="sm" className="mt-8" />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <p className="text-sm text-tertiary">{t.intro}</p>
      <div className="flex items-end gap-3">
        <Select
          label={t.robot}
          size="sm"
          isDisabled={running}
          selectedKey={choice.type}
          onSelectionChange={(k) => set({ type: String(k) })}
          items={ROBOT_TYPES.map((r) => ({ id: r.label, label: r.label }))}
          className="min-w-0 flex-1"
        >
          {(item) => <Select.Item {...item} />}
        </Select>
        <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary p-1.5">
          <img src={robotTypeByLabel(choice.type).illustration} alt="" className="size-full object-contain" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Select
            label={t.start}
            placeholder={t.pick}
            size="sm"
            isDisabled={running}
            selectedKey={choice.start || null}
            onSelectionChange={(k) => set({ start: String(k) })}
            items={stations}
          >
            {(item) => <Select.Item {...item} />}
          </Select>
          <Select
            label={t.end}
            placeholder={t.pick}
            size="sm"
            isDisabled={running}
            selectedKey={choice.end || null}
            onSelectionChange={(k) => set({ end: String(k) })}
            items={stations}
          >
            {(item) => <Select.Item {...item} />}
          </Select>
        </div>
        <ButtonUtility
          size="sm"
          color="secondary"
          icon={SwitchVertical01}
          tooltip={t.swap}
          aria-label={t.swap}
          isDisabled={running || (!choice.start && !choice.end)}
          onPress={() => set({ start: choice.end, end: choice.start })}
          className="mt-6 shrink-0"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label={a.leaving}
          size="sm"
          isDisabled={running}
          selectedKey={choice.laden ? 'laden' : 'empty'}
          onSelectionChange={(k) => set({ laden: k === 'laden' })}
          items={[
            { id: 'empty', label: a.empty },
            { id: 'laden', label: a.laden },
          ]}
        >
          {(item) => <Select.Item {...item} />}
        </Select>
        <Select
          label={a.task}
          size="sm"
          isDisabled={running}
          selectedKey={choice.pick ? 'pick' : 'drop'}
          onSelectionChange={(k) => set({ pick: k === 'pick' })}
          items={[
            { id: 'drop', label: a.drop },
            { id: 'pick', label: a.pick },
          ]}
        >
          {(item) => <Select.Item {...item} />}
        </Select>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-error-secondary px-3 py-2 text-sm text-error-primary">
          {error}
        </p>
      )}
      {running ? (
        <Button size="md" color="secondary" onPress={onStop}>
          {t.stop}
        </Button>
      ) : (
        <Button size="md" color="primary" isDisabled={!choice.start || !choice.end} onPress={onRun}>
          {state.status === 'done' ? t.again : t.run}
        </Button>
      )}
      {!error && info.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg bg-secondary px-3 py-2 text-xs text-tertiary" role="status">
          {info.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
      {(running || state.status === 'done') && (
        <div className="flex flex-col gap-2" role="status" aria-live="polite">
          <ProgressBar value={state.progress} max={100} valueFormatter={() => ''} />
          <p className="text-sm text-secondary">{state.status === 'done' ? t.done : state.step}</p>
        </div>
      )}
      <RouteCheckPanel
        data={data}
        fleet={fleet}
        robot={choice.type}
        busy={running}
        onShow={(start, end, type) => set({ start, end, type })}
      />
    </div>
  );
}
