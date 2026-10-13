import { Card, CardTitle } from '@/components/data/Card';
import { SegmentedTabs } from '@/components/data/SegmentedTabs';
import { copy } from '../copy';
import { METRICS, TREND_METRICS } from '../model/metrics';
import type { MetricId, Report } from '../model/types';
import { MetricHint } from './DirectionBadge';
import { TrendChart } from './TrendChart';

const AVAILABILITY_TARGET = 85;

/** One trend chart with a switch between the five trend metrics (instead of five charts under each other). */
export function TrendPanel({ report, metric, onMetric }: { report: Report; metric: MetricId; onMetric(id: MetricId): void }) {
  const m = METRICS[metric], points = report.series[metric] ?? [], daily = report.range.days > 1, real = points.filter((p) => p.value !== null).length;
  return (
    <Card>
      <CardTitle title={<span className="inline-flex flex-wrap items-center gap-1">{m.chartTitle}<MetricHint metric={m} /></span>} hint={`${copy.trend.hint(daily)} · ${copy.better[m.better].toLowerCase()}`}>
        <div className="max-w-full overflow-x-auto"><SegmentedTabs<MetricId> label={copy.trend.title} value={metric} onChange={onMetric} items={TREND_METRICS.map((id) => ({ id, label: METRICS[id].short }))} /></div>
      </CardTitle>
      {real < 2 ? <p className="grid h-52 place-items-center text-sm text-tertiary">{copy.trend.collecting}</p> : <TrendChart metric={m} points={points} daily={daily} target={metric === 'chargingAvailability' ? AVAILABILITY_TARGET : undefined} height={208} />}
    </Card>
  );
}
