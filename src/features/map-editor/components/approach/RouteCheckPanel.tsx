import { useState } from 'react';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { ProgressBar } from '@/components/base/progress-indicators/progress-indicators';
import { ROBOT_TYPES, robotTypeByLabel } from '@/data/robotTypes';
import type { Finding } from '../../model/checkRoutes';
import type { MapData } from '../../model/types';
import { useRouteCheck } from '../../sim/useRouteCheck';
import { copy } from './copy';

const SHOWN = 6;
/**
 * "Check all routes" of the Simulation panel: tick the robot types, plan a trip between every pair of stations for each, and list what cannot be driven (a station no road reaches, no node that
 * allows the trip, no route) and, as a warning, turns tighter than the robot can make. A finding opens that pair in the simulation above.
 */
export function RouteCheckPanel({
  data,
  fleet,
  robot,
  busy,
  onShow,
}: {
  data: MapData;
  fleet: string;
  /** the robot type chosen above: ticked at first */
  robot: string;
  /** a trip is being driven */
  busy: boolean;
  onShow(from: string, to: string, robot: string): void;
}) {
  const t = copy.check;
  const check = useRouteCheck(data, fleet);
  const [picked, setPicked] = useState<string[]>([]);
  const chosen = picked.length ? picked : [robot];
  const running = check.status === 'running';
  const name = (id: string) => data.stations.find((s) => s.id === id)?.name ?? id;
  const result = check.result;
  const bad = result?.findings.filter((f) => f.kind !== 'tight') ?? [];
  const tight = result?.findings.filter((f): f is Extract<Finding, { kind: 'tight' }> => f.kind === 'tight') ?? [];
  const list = [...bad, ...tight];
  const text = (f: Finding) =>
    f.kind === 'unlinked' || f.kind === 'no-node'
      ? `${name(f.station)}${f.kind === 'no-node' ? ` · ${copy.sim.what[f.slot]}` : ''}`
      : f.kind === 'tight'
        ? t.tightDetail(f.count, String(f.radius), String(f.need))
        : `${name(f.from)} → ${name(f.to)}`;
  return (
    <section className="flex flex-col gap-3 border-t border-secondary pt-4" aria-label={t.title}>
      <h3 className="text-sm font-semibold text-primary">{t.title}</h3>
      <p className="text-xs text-tertiary">{t.intro}</p>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-secondary">{t.robots}</span>
        {ROBOT_TYPES.filter((r) => !r.placeholder || r.label === robot || picked.includes(r.label)).map((r) => (
          <Checkbox
            key={r.id}
            size="sm"
            label={r.label}
            isDisabled={running}
            isSelected={chosen.includes(r.label)}
            onChange={(on) => setPicked(on ? [...chosen, r.label] : chosen.filter((x) => x !== r.label))}
          />
        ))}
        {chosen.map((r) => {
          const c = robotTypeByLabel(r).capabilities;
          return (
            <p key={r} className="text-xs text-tertiary">
              {t.robotSetting(
                r,
                copy.maneuvers[c.defaultManeuver as keyof typeof copy.maneuvers]?.label ?? c.defaultManeuver,
                String(c.minTurnRadius),
              )}
            </p>
          );
        })}
      </div>
      {data.stations.length < 2 ? (
        <p className="text-xs text-tertiary">{t.none}</p>
      ) : running ? (
        <div className="flex flex-col gap-2" role="status">
          <ProgressBar value={check.progress} max={100} valueFormatter={() => ''} />
          <Button size="sm" color="secondary" onPress={check.stop}>
            {t.stop}
          </Button>
        </div>
      ) : (
        <Button size="sm" color="secondary" isDisabled={busy} onPress={() => void check.run(chosen)}>
          {result ? t.again : t.run}
        </Button>
      )}
      {result && !running && (
        <div className="flex flex-col gap-2" role="status" aria-live="polite">
          <p className="text-sm text-secondary">
            {t.summary(
              result.checked,
              result.ok,
              bad.length,
              tight.reduce((n, f) => n + f.count, 0),
            )}
          </p>
          {!list.length && <p className="text-sm text-success-primary">{t.allGood}</p>}
          <ul className="flex flex-col gap-1.5">
            {list.slice(0, SHOWN).map((f, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg bg-secondary px-2.5 py-2 text-xs text-secondary">
                <Badge size="sm" color={f.kind === 'tight' ? 'warning' : 'error'} className="shrink-0">
                  {t.kinds[f.kind]}
                </Badge>
                <span className="min-w-0 flex-1">
                  {text(f)}
                  {chosen.length > 1 && <span className="text-tertiary"> · {f.robot}</span>}
                </span>
                {'from' in f && (
                  <button
                    type="button"
                    className="shrink-0 font-medium text-brand-secondary hover:underline"
                    onClick={() => onShow(f.from, f.to, f.robot)}
                  >
                    {t.show}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {list.length > SHOWN && <p className="text-xs text-tertiary">{t.more(list.length - SHOWN)}</p>}
        </div>
      )}
    </section>
  );
}
