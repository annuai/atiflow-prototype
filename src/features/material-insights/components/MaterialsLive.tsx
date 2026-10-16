import { Package, Truck01 } from '@untitledui/icons';
import { BadgeWithDot } from '@/components/base/badges/badges';
import { Card, CardTitle } from '@/components/data/Card';
import { EmptyState } from '@/components/data/EmptyState';
import { StatusStrip } from '@/components/data/StatusStrip';
import { cx } from '@/utils/cx';
import { useNow } from '@/hooks/use-now';
import { useMaterialsView } from '../model/useMaterials';
import type { MaterialRequest, Period } from '../model/types';
import { t } from '../text';
import { Bars } from './Bars';
import { minutesText, msText } from './format';

/** A request is "waiting too long" when it has waited this long for approval / for a robot (minutes). PLACEHOLDER thresholds until the person can set them in Preferences. */
const WARN_APPROVAL_MIN = 15,
  WARN_ROBOT_MIN = 10;

const today = (): Period => {
  const d = new Date(),
    day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return { from: day, to: day, days: 1, label: '', previousLabel: '' };
};

function Kpi({
  label,
  hint,
  value,
  sub,
  tone = 'text-primary',
}: {
  label: string;
  hint: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-sm text-tertiary" title={hint}>
        {label}
      </p>
      <p className={cx('text-3xl font-semibold tabular-nums', tone)}>{value}</p>
      <p className="text-xs text-tertiary">{sub}</p>
    </Card>
  );
}

const route = (r: MaterialRequest) => `${r.legs[0] ?? ''} → ${r.legs[r.legs.length - 1] ?? ''}`;

/**
 * The Dashboard's Materials view: what is being asked for and what is on its way right now, for the fleets that move material. It is a view of its own (not mixed into the fleet
 * cards) because fleets that only run saved routes have no material to report. Numbers are today's, from the saved requests (example data until there is a request, then labelled).
 */
export function MaterialsLive() {
  const view = useMaterialsView(today());
  const now = useNow(30_000);
  const { stats: s, waiting: w } = view;
  const open = w.approval.length + w.robot.length;
  const slow = w.oldestApprovalMs / 60_000 > WARN_APPROVAL_MIN || w.oldestRobotMs / 60_000 > WARN_ROBOT_MIN;
  const hourly = view.series.filter((p) => p.label.getHours() >= 5 && p.label.getHours() <= 22);
  return (
    <div className="flex flex-col gap-5">
      {view.origin === 'sample' && (
        <div className="flex flex-wrap items-center gap-2">
          <BadgeWithDot size="md" color="warning">
            {t.sample.badge}
          </BadgeWithDot>
          <span className="text-xs text-tertiary">{t.sample.live}</span>
        </div>
      )}
      <StatusStrip
        status={
          slow
            ? {
                level: 'warn',
                headline: t.live.statusWarn(open),
                detail: t.live.statusWarnDetail(w.approval.length, w.robot.length),
              }
            : { level: 'ok', headline: t.live.statusOk, detail: t.live.statusOkDetail }
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi
          label={t.live.kpi.requests}
          hint={t.live.kpiHint.requests}
          value={String(s.requests)}
          sub={t.live.kpiSub.requests(s.unitsAsked)}
        />
        <Kpi
          label={t.live.kpi.inProgress}
          hint={t.live.kpiHint.inProgress}
          value={String(open + w.moving.length)}
          sub={t.live.kpiSub.inProgress(w.moving.length)}
          tone={open + w.moving.length ? 'text-fg-brand-primary' : 'text-primary'}
        />
        <Kpi
          label={t.live.kpi.delivered}
          hint={t.live.kpiHint.delivered}
          value={String(s.units)}
          sub={t.live.kpiSub.delivered(s.delivered)}
        />
        <Kpi
          label={t.live.kpi.fulfilment}
          hint={t.live.kpiHint.fulfilment}
          value={s.fulfilmentPct === null ? t.duration.none : `${s.fulfilmentPct}%`}
          sub={t.live.kpiSub.fulfilment(s.delivered + s.cancelled + s.rejected + s.failed)}
          tone={s.fulfilmentPct !== null && s.fulfilmentPct < 90 ? 'text-fg-warning-primary' : 'text-primary'}
        />
        <Kpi
          label={t.live.kpi.cycle}
          hint={t.live.kpiHint.cycle}
          value={minutesText(s.cycleMin)}
          sub={t.live.kpiSub.cycle(s.delivered)}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardTitle title={t.live.movingTitle} hint={t.live.movingHint} />
          {w.moving.length === 0 ? (
            <EmptyState icon={Truck01} size="sm" title={t.live.movingEmpty} subtext={t.live.movingEmptyHint} />
          ) : (
            <ul className="flex flex-col divide-y divide-secondary">
              {w.moving.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-primary">
                      {r.name} <span className="font-normal text-tertiary">· {t.units(r.qty)}</span>
                    </p>
                    <p className="text-xs text-tertiary">
                      {r.code} · {route(r)}
                    </p>
                  </div>
                  <p className="text-xs text-tertiary">
                    {r.robotId ? `${r.robotId} · ` : ''}
                    {t.live.row.elapsed(msText(now - (r.at.ongoing ?? now)))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle title={t.live.waitingTitle} hint={t.live.waitingHint} />
          {open === 0 ? (
            <EmptyState icon={Package} size="sm" title={t.live.nothingWaiting} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: t.live.waitApproval, n: w.approval.length, age: w.oldestApprovalMs },
                { label: t.live.waitRobot, n: w.robot.length, age: w.oldestRobotMs },
              ].map((x) => (
                <div key={x.label} className="rounded-lg bg-secondary p-3">
                  <p className="text-xs text-tertiary">{x.label}</p>
                  <p className="text-2xl font-semibold text-primary tabular-nums">{x.n}</p>
                  <p className="text-xs text-tertiary">{x.n ? t.live.oldest(msText(x.age)) : '—'}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardTitle title={t.live.hourTitle} hint={t.live.hourHint} />
          <Bars
            values={hourly.map((p) => p.units)}
            labels={hourly.map((p) => String(p.label.getHours()).padStart(2, '0'))}
          />
        </Card>
        <Card>
          <CardTitle title={t.live.topTitle} hint={t.live.topHint} />
          {view.top.length === 0 ? (
            <EmptyState icon={Package} size="sm" title={t.live.topEmpty} />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {view.top.map((m) => (
                <li key={m.code}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-primary">{m.name}</span>
                    <span className="shrink-0 text-tertiary tabular-nums">{t.units(m.units)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-quaternary">
                    <div
                      className="h-full rounded-full bg-fg-brand-primary"
                      style={{ width: `${(m.units / Math.max(1, view.top[0].units)) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
