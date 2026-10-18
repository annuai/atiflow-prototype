import { useState, type FC, type ReactNode } from 'react';
import { StatusDot } from '@/components/data/StatusDot';
import {
  BatteryFull,
  Eye,
  GamingPad01,
  Infinity as InfinityIcon,
  MarkerPin01,
  Shield01,
  Sliders04,
  Truck01,
  VolumeMax,
} from '@untitledui/icons';
import { EmptyState } from '@/components/data/EmptyState';
import { Skeleton } from '@/components/skeleton/Skeleton';
import { cx } from '@/utils/cx';
import { copy } from '../copy';
import { categoryLabel, groupLabel, ins } from '../labels';
import { useRobotConfig } from '../data/useRobotConfig';
import { customised, groupParams } from '../model/config';
import type { RobotRef } from '../model/types';
import { ConfigParamField } from './ConfigParamField';
import { FactoryReset } from './FactoryReset';
import { TabHeader, TabState } from './TabParts';

/** An icon per category id (a category without one gets the generic sliders). */
const ICONS: Record<string, FC<{ className?: string }>> = {
  safety: Shield01,
  audio: VolumeMax,
  battery: BatteryFull,
  yelli: MarkerPin01,
  vehicle: Truck01,
  perception: Eye,
  control: GamingPad01,
  peripherals: InfinityIcon,
  advanced: Sliders04,
};

/** The category that holds the rarely wanted, risky actions. */
const ADVANCED = 'advanced';

/** What the page footer needs from the tab: the edit state and its three actions. The page decides how the footer looks (it also holds Remove / Unassign). */
export interface EditFooter {
  editing: boolean;
  busy: boolean;
  onEdit(): void;
  onCancel(): void;
  onSave(): void;
  /** the footer's primary button is not usable yet (still loading) */
  disabled: boolean;
  editLabel: string;
}

/** The Configuration tab: categories on the left, the parameters of the chosen one on the right. Reads and writes through the robot service (`useRobotConfig`). */
export function ConfigurationTab({ robot, renderFooter }: { robot: RobotRef; renderFooter(f: EditFooter): ReactNode }) {
  const cfg = useRobotConfig(robot);
  const [category, setCategory] = useState('safety');
  const { schema, shown, values } = cfg;
  const ready = !!schema && !!shown && !!values;
  const current = schema?.categories.find((c) => c.id === category) ?? schema?.categories[0];
  return (
    <>
      <div className="flex flex-1 flex-col gap-6">
        <TabHeader title={copy.config.title} subtitle={copy.config.subtitle} />
        <TabState
          loading={cfg.loading && !ready}
          error={cfg.error}
          failTitle={copy.config.loadFailed}
          onRetry={cfg.reload}
          skeleton={
            <div className="flex flex-col gap-4 md:flex-row">
              <Skeleton className="h-72 w-full rounded-xl md:w-48" />
              <Skeleton className="h-72 flex-1 rounded-xl" />
            </div>
          }
        />
        {ready && current && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
            <nav aria-label={ins.sectionsAria} className="flex shrink-0 gap-1 overflow-x-auto md:w-52 md:flex-col">
              {schema.categories.map((c) => {
                const Icon = ICONS[c.id] ?? Sliders04;
                const n = customised(c, values, schema.defaults);
                const on = c.id === current.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-current={on ? 'true' : undefined}
                    onClick={() => setCategory(c.id)}
                    className={cx(
                      'flex shrink-0 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold outline-focus-ring transition focus-visible:outline-2',
                      on ? 'bg-secondary text-primary' : 'text-tertiary hover:bg-primary_hover hover:text-secondary',
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1 whitespace-nowrap">{categoryLabel(c)}</span>
                    {n > 0 && <StatusDot tone="brand" size="sm" label={copy.config.customised(n)} />}
                  </button>
                );
              })}
            </nav>
            <section
              aria-label={categoryLabel(current)}
              className="min-h-72 flex-1 rounded-xl border border-secondary bg-secondary_subtle p-4 sm:p-5"
            >
              {current.params.length === 0 && current.id !== ADVANCED ? (
                <EmptyState
                  size="sm"
                  icon={Sliders04}
                  title={copy.config.emptyCategory}
                  subtext={copy.config.emptyCategoryBody}
                />
              ) : (
                <div className="flex flex-col gap-6">
                  {groupParams(current).map((g) => (
                    <div key={g.heading ?? ''} className="flex flex-col gap-4">
                      {g.heading && <h3 className="text-sm font-semibold text-primary">{groupLabel(g.heading)}</h3>}
                      {g.params.map((p) => (
                        <ConfigParamField
                          key={p.key}
                          param={p}
                          value={shown[p.key] ?? schema.defaults[p.key] ?? ''}
                          error={cfg.errors[p.key]}
                          disabled={!cfg.editing || cfg.busy}
                          onChange={(v) => cfg.setValue(p.key, v)}
                        />
                      ))}
                    </div>
                  ))}
                  {current.id === ADVANCED && (
                    <FactoryReset
                      robotName={robot.name}
                      disabled={cfg.busy || cfg.editing}
                      onRestore={() => void cfg.restoreDefaults()}
                    />
                  )}
                </div>
              )}
            </section>
          </div>
        )}
        {renderFooter({
          editing: cfg.editing,
          busy: cfg.busy,
          onEdit: cfg.start,
          onCancel: cfg.cancel,
          onSave: () => void cfg.save(),
          disabled: !ready,
          editLabel: copy.config.edit,
        })}
      </div>
    </>
  );
}
