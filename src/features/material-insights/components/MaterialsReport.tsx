import { ArrowDown, ArrowUp, Package } from '@untitledui/icons';
import { fleetDirectory } from '@/data/fleetDirectory';
import { BadgeWithDot } from '@/components/base/badges/badges';
import { Card, CardTitle } from '@/components/data/Card';
import { EmptyState } from '@/components/data/EmptyState';
import { cx } from '@/utils/cx';
import { useMaterialsView } from '../model/useMaterials';
import type { MaterialStats, Period } from '../model/types';
import { t } from '../text';
import { Bars } from './Bars';
import { MaterialHeatMap } from './MaterialHeatMap';
import { minutesText } from './format';
import { formatDate } from '@/i18n';

/** How a figure moved against the period before. `better` says which direction is good for THIS figure (a falling approval time is green). */
function Change({
  now,
  before,
  better,
  vs,
}: {
  now: number | null;
  before: number | null;
  better: 'higher' | 'lower';
  vs: string;
}) {
  if (now === null || before === null || before === 0) return <span className="text-xs text-tertiary">{vs}</span>;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return <span className="text-xs text-tertiary">{t.report.flat}</span>;
  const good = pct > 0 === (better === 'higher');
  const Icon = pct > 0 ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap">
      <span
        className={cx(
          'inline-flex items-center gap-0.5 font-medium',
          good ? 'text-fg-success-primary' : 'text-fg-error-primary',
        )}
      >
        <Icon className="size-3" />
        {Math.abs(pct)}%
      </span>
      <span className="text-tertiary">{vs}</span>
    </span>
  );
}

interface Def {
  id: keyof typeof t.report.kpi;
  value(s: MaterialStats): number | null;
  text(v: number | null): string;
  better: 'higher' | 'lower';
}
/** THE list of material KPIs of the report: how each is read from the stats, shown, and which direction is good. A new KPI = one entry here and its words in the catalog. */
const KPIS: Def[] = [
  { id: 'units', value: (s) => s.units, text: (v) => (v === null ? '—' : t.units(v)), better: 'higher' },
  { id: 'requests', value: (s) => s.requests, text: (v) => String(v ?? 0), better: 'higher' },
  { id: 'fulfilment', value: (s) => s.fulfilmentPct, text: (v) => (v === null ? '—' : `${v}%`), better: 'higher' },
  { id: 'cycle', value: (s) => s.cycleMin, text: minutesText, better: 'lower' },
  { id: 'approval', value: (s) => s.approvalMin, text: minutesText, better: 'lower' },
];

const dayLabel = (d: Date) => formatDate(d, 'day', { deviceZone: true });
const hourLabel = (d: Date) => String(d.getHours()).padStart(2, '0');

/**
 * The Reports "Materials" section: how much material moved over the chosen period and how the requests went, against the period before. A separate section (not mixed into the
 * fleet KPIs) because fleets that only run saved routes have no material to report. Example data until there are requests in the period, then labelled.
 */
export function MaterialsReport({ period }: { period: Period }) {
  const view = useMaterialsView(period, 60_000);
  const { stats: s, previous: p } = view;
  const ended = s.delivered + s.cancelled + s.rejected + s.failed;
  const total = view.top.reduce((a, m) => a + m.units, 0) || 1;
  const empty = s.requests === 0 && s.delivered === 0;
  const hourly =
    view.bucket === 'hour'
      ? view.series.filter((x) => x.label.getHours() >= 5 && x.label.getHours() <= 22)
      : view.series;
  return (
    <div className="flex flex-col gap-5">
      {view.origin === 'sample' && (
        <div className="flex flex-wrap items-center gap-2">
          <BadgeWithDot size="md" color="warning">
            {t.sample.badge}
          </BadgeWithDot>
          <span className="text-xs text-tertiary">{t.sample.report}</span>
        </div>
      )}
      {empty ? (
        <EmptyState icon={Package} size="lg" title={t.report.emptyTitle} subtext={t.report.emptyHint} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {KPIS.map((k) => (
              <Card key={k.id} className="flex flex-col gap-1">
                <p className="text-sm text-tertiary" title={t.report.kpiHint[k.id]}>
                  {t.report.kpi[k.id]}
                </p>
                <p className="text-3xl font-semibold text-primary tabular-nums">{k.text(k.value(s))}</p>
                <Change now={k.value(s)} before={k.value(p)} better={k.better} vs={t.report.vs(period.previousLabel)} />
                <p className="text-[11px] text-quaternary">{t.report.better[k.better]}</p>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card>
              <CardTitle
                title={t.report.trendTitle}
                hint={view.bucket === 'hour' ? t.report.trendHintHour : t.report.trendHintDay}
              />
              <Bars
                values={hourly.map((x) => x.units)}
                labels={hourly.map((x) => (view.bucket === 'hour' ? hourLabel(x.label) : dayLabel(x.label)))}
                height={150}
              />
            </Card>
            <Card>
              <CardTitle title={t.report.outcomeTitle} />
              <ul className="flex flex-col gap-2.5">
                {(['delivered', 'cancelled', 'rejected', 'failed'] as const).map((k) => (
                  <li key={k}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-primary">{t.report.outcome[k]}</span>
                      <span className="text-tertiary tabular-nums">{s[k]}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-quaternary">
                      <div
                        className={cx(
                          'h-full rounded-full',
                          k === 'delivered'
                            ? 'bg-fg-success-primary'
                            : k === 'cancelled'
                              ? 'bg-fg-quaternary'
                              : 'bg-fg-error-primary',
                        )}
                        style={{ width: `${ended ? (s[k] / ended) * 100 : 0}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <MaterialHeatMap />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card>
              <CardTitle title={t.report.topTitle} hint={t.report.topHint} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-tertiary">
                    <tr>
                      <th className="pb-2 font-medium">{t.report.topCols.material}</th>
                      <th className="pb-2 text-right font-medium">{t.report.topCols.units}</th>
                      <th className="pb-2 text-right font-medium">{t.report.topCols.requests}</th>
                      <th className="pb-2 text-right font-medium">{t.report.topCols.share}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary">
                    {view.top.map((m) => (
                      <tr key={m.code}>
                        <td className="py-2 pr-3">
                          <span className="text-primary">{m.name}</span>{' '}
                          <span className="text-xs text-tertiary">{m.code}</span>
                        </td>
                        <td className="py-2 text-right tabular-nums">{m.units}</td>
                        <td className="py-2 text-right tabular-nums">{m.requests}</td>
                        <td className="py-2 text-right text-tertiary tabular-nums">
                          {Math.round((m.units / total) * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            {view.byFleet.length > 1 && (
              <Card>
                <CardTitle title={t.report.fleetTitle} hint={t.report.fleetHint} />
                <ul className="flex flex-col gap-2.5">
                  {view.byFleet.map((f) => (
                    <li key={f.fleet}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="text-primary">{fleetDirectory.nameOf(f.fleet)}</span>
                        <span className="text-tertiary tabular-nums">{t.units(f.units)}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-quaternary">
                        <div
                          className="h-full rounded-full bg-fg-brand-primary"
                          style={{ width: `${(f.units / Math.max(1, view.byFleet[0].units)) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
