import { Card } from '@/components/data/Card';
import { cx } from '@/utils/cx';
import { METRICS, HEADLINE, formatMetric } from '../model/metrics';
import { insights } from '../insightsCopy';
import type { MetricId, Report } from '../model/types';
import { BetterHint, MetricHint } from './DirectionBadge';
import { Delta } from './Delta';
import { Spark } from './Spark';

/** The five numbers that matter, one row (same look as the dashboard's KPI row): value, trend line, how it moved, and which direction is the good one. Click one to see its trend. */
export function Scorecard({
  report,
  selected,
  onPick,
}: {
  report: Report;
  selected: MetricId;
  onPick(id: MetricId): void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {HEADLINE.map((id) => {
        const m = METRICS[id],
          v = report.fleet[id],
          series = (report.series[id] ?? []).map((p) => p.value).filter((x): x is number => x !== null);
        return (
          <Card
            key={id}
            className={cx('transition-shadow max-md:last:col-span-2', selected === id && 'ring-2 ring-brand')}
          >
            <button
              type="button"
              className="flex w-full min-w-0 flex-col gap-1 text-left outline-focus-ring focus-visible:outline-2"
              onClick={() => onPick(id)}
              aria-pressed={selected === id}
              aria-label={insights.reports.showTrend(m.label)}
            >
              <span className="flex items-center gap-0.5 text-sm text-tertiary">
                {m.label}
                <span onClick={(e) => e.stopPropagation()}>
                  <MetricHint metric={m} />
                </span>
              </span>
              <span className="text-3xl font-semibold whitespace-nowrap tabular-nums text-primary">
                {formatMetric(m, v)}
                {m.unit && <span className="ml-1 text-[0.5em] font-medium text-tertiary">{m.unit}</span>}
              </span>
              <span className="block h-7 w-full">
                <Spark values={series} />
              </span>
              <span className="flex min-h-4 flex-wrap items-center justify-between gap-x-2">
                <Delta
                  metric={m}
                  value={v}
                  previous={report.previous?.[id] ?? null}
                  label={report.range.previousLabel}
                />
                <BetterHint metric={m} />
              </span>
            </button>
          </Card>
        );
      })}
    </div>
  );
}
