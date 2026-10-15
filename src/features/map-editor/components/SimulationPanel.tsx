import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { ProgressBar } from '@/components/base/progress-indicators/progress-indicators';
import { Select } from '@/components/base/select/select';
import { EmptyState } from '@/components/data/EmptyState';
import { ROBOT_TYPES, robotTypeByLabel } from '@/data/robotTypes';
import { Route, SwitchVertical01 } from '@untitledui/icons';
import { copy } from '../copy';
import type { MapData } from '../model/types';
import type { SimState } from '../sim/tripSim';

export interface SimChoice { type: string; start: string; end: string }
/** The Simulation panel: pick the robot type FIRST, then the start and end station, then Simulate route. The robot drives the lanes of this map from one to the other. */
export function SimulationPanel({ data, choice, onChoice, state, error, onRun, onStop }: { data: MapData; choice: SimChoice; onChoice(c: SimChoice): void; state: SimState; error: string; onRun(): void; onStop(): void }) {
  const t = copy.sim; const running = state.status === 'running';
  const stations = [...data.stations].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map((s) => ({ id: s.id, label: `${s.name} · ${s.id}` }));
  const set = (patch: Partial<SimChoice>) => onChoice({ ...choice, ...patch });
  if (!stations.length) return <EmptyState icon={Route} title={t.noStations} subtext={t.noStationsHint} size="sm" className="mt-8" />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <p className="text-sm text-tertiary">{t.intro}</p>
      <div className="flex items-end gap-3">
        <Select label={t.robot} size="sm" isDisabled={running} selectedKey={choice.type} onSelectionChange={(k) => set({ type: String(k) })} items={ROBOT_TYPES.map((r) => ({ id: r.label, label: r.label }))} className="min-w-0 flex-1">{(item) => <Select.Item {...item} />}</Select>
        <div className="grid h-14 w-20 shrink-0 place-items-center rounded-lg bg-secondary p-1.5"><img src={robotTypeByLabel(choice.type).illustration} alt="" className="max-h-full max-w-full object-contain" /></div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
        <Select label={t.start} placeholder={t.pick} size="sm" isDisabled={running} selectedKey={choice.start || null} onSelectionChange={(k) => set({ start: String(k) })} items={stations}>{(item) => <Select.Item {...item} />}</Select>
        <Select label={t.end} placeholder={t.pick} size="sm" isDisabled={running} selectedKey={choice.end || null} onSelectionChange={(k) => set({ end: String(k) })} items={stations}>{(item) => <Select.Item {...item} />}</Select>
        </div>
        <ButtonUtility size="sm" color="secondary" icon={SwitchVertical01} tooltip={t.swap} aria-label={t.swap} isDisabled={running || (!choice.start && !choice.end)} onPress={() => set({ start: choice.end, end: choice.start })} className="mt-6 shrink-0" />
      </div>
      {error && <p role="alert" className="rounded-lg bg-error-secondary px-3 py-2 text-sm text-error-primary">{error}</p>}
      {running
        ? <Button size="md" color="secondary" onPress={onStop}>{t.stop}</Button>
        : <Button size="md" color="primary" isDisabled={!choice.start || !choice.end} onPress={onRun}>{state.status === 'done' ? t.again : t.run}</Button>}
      {(running || state.status === 'done') && (
        <div className="flex flex-col gap-2" role="status" aria-live="polite">
          <ProgressBar value={state.progress} max={100} valueFormatter={() => ''} />
          <p className="text-sm text-secondary">{state.status === 'done' ? t.done : state.step}</p>
        </div>
      )}
    </div>
  );
}
