import { useEffect, useState } from 'react';
import { Map01 } from '@untitledui/icons';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Label } from '@/components/base/input/label';
import { Select } from '@/components/base/select/select';
import { FormField } from '@/components/form/FormField';
import { ModalShell } from '@/components/modal/ModalShell';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { validateNewMap, type NewMapForm } from '../model/logic';
import { mockRunData, type RunData, type RunDataSource } from '../model/runData';
import { DEFAULT_ROUTING, ROUTING_VERSIONS } from '../model/routing';
import { useMaps } from '../model/maps';
import { RobotPicker } from './RobotPicker';
import { RoutingVersionPicker } from './RoutingVersionPicker';
import { focusFirstError } from '@/utils/focus-first-error';
import { authStore } from '@/features/auth';
import { deviceStore, nameOf as deviceName } from '@/features/devices';
import { createGeneratedMap } from '../model/generateMap';

const BLANK: NewMapForm = { name: '', robot: '', runData: '', version: DEFAULT_ROUTING, zMin: '', zMax: '' };

/** The robot added last (its name), or none. */
const lastRobot = () => {
  const d = deviceStore.getState().robot.at(-1);
  return d ? deviceName(d) : '';
};

function Body({ onOpenChange, source }: { onOpenChange(o: boolean): void; source: RunDataSource }) {
  const maps = useMaps();
  const t = copy.generate;
  // the robot that was added last is chosen to begin with (a first map is nearly always made from the robot just added)
  const [f, setF] = useState<NewMapForm>(() => ({ ...BLANK, robot: lastRobot() }));
  const [posegraph, setPosegraph] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState<{ robot: string; runs: RunData[] } | null>(null);
  const set = (patch: Partial<NewMapForm>) => {
    setF((o) => ({ ...o, ...patch }));
    setErrors((e) => {
      const n = { ...e };
      Object.keys(patch).forEach((k) => delete n[k]);
      return n;
    });
  };
  // run data depends on the chosen robot
  useEffect(() => {
    let live = true;
    if (f.robot) source.forRobot(f.robot).then((r) => live && setLoaded({ robot: f.robot, runs: r }));
    return () => {
      live = false;
    };
  }, [f.robot, source]);
  const runs = f.robot && loaded?.robot === f.robot ? loaded.runs : null; // (null while the robot's runs are loading)
  const submit = () => {
    const e = validateNewMap(f, maps, t.errors);
    setErrors(e);
    if (Object.keys(e).length) return focusFirstError();
    const by = authStore.getState().user?.username ?? 'system';
    createGeneratedMap({
      name: f.name,
      routing: ROUTING_VERSIONS.find((v) => v.id === f.version)?.version ?? 5,
      robot: f.robot,
      runData: f.runData,
      by,
    });
    onOpenChange(false);
    notify.success(t.done.title, t.done.body(f.name.trim(), f.robot), 'map-generate');
  };
  const runOptions = (runs ?? []).map((r) => ({ id: r.id, label: r.label }));
  return (
    <ModalShell
      isOpen
      onOpenChange={onOpenChange}
      icon={Map01}
      title={t.title}
      subtitle={t.subtitle}
      size="lg"
      divided
      secondary={{ label: t.cancel, onPress: () => onOpenChange(false) }}
      primary={{ label: t.submit }}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-5 pt-4">
        <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-tertiary">{t.sample}</p>
        <FormField
          def={{ key: 'name', label: t.name, control: 'text', placeholder: t.namePlaceholder, required: true }}
          value={f.name}
          onChange={(v) => set({ name: String(v) })}
          error={errors.name}
          fleets={[]}
        />
        <RobotPicker value={f.robot} onChange={(robot) => set({ robot, runData: '' })} error={errors.robot} />
        <div className="flex flex-col gap-1.5">
          <Label isRequired tooltip={t.runDataHint}>
            {t.runData}
          </Label>
          <Select
            aria-label={t.runData}
            isDisabled={!f.robot || runs === null}
            placeholder={
              !f.robot
                ? t.runDataNeedsRobot
                : runs === null
                  ? t.runDataLoading
                  : runs.length
                    ? t.runDataPlaceholder
                    : t.runDataNone
            }
            selectedKey={f.runData || null}
            onSelectionChange={(k) => set({ runData: String(k) })}
            items={runOptions}
          >
            {(item) => <Select.Item {...item} />}
          </Select>
          {errors.runData && (
            <p className="text-sm text-error-primary" role="alert">
              {errors.runData}
            </p>
          )}
        </div>
        <RoutingVersionPicker
          label={t.version}
          value={f.version}
          onChange={(v) => set({ version: v })}
          error={errors.version}
        />
        <div className="flex items-center gap-4 text-xs font-medium tracking-wide text-tertiary">
          <span className="h-px flex-1 bg-border-secondary" />
          {t.optional}
          <span className="h-px flex-1 bg-border-secondary" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            def={{ key: 'zMin', label: t.zMin, control: 'text', placeholder: '0.0' }}
            value={f.zMin}
            onChange={(v) => set({ zMin: String(v) })}
            error={errors.zMin}
            fleets={[]}
          />
          <FormField
            def={{ key: 'zMax', label: t.zMax, control: 'text', placeholder: '3.0' }}
            value={f.zMax}
            onChange={(v) => set({ zMax: String(v) })}
            error={errors.zMax}
            fleets={[]}
          />
        </div>
        <Checkbox size="sm" label={t.posegraph} hint={t.posegraphHint} isSelected={posegraph} onChange={setPosegraph} />
      </div>
    </ModalShell>
  );
}
/** "Generate New Map" dialog: validates the form and makes a draft map from the robot's run data (an example hall until real run data exists). Mounted only while open. */
export const GenerateMapModal = (p: { isOpen: boolean; onOpenChange(o: boolean): void; source?: RunDataSource }) =>
  p.isOpen ? <Body onOpenChange={p.onOpenChange} source={p.source ?? mockRunData} /> : null;
