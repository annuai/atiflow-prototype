import { Card } from '@/components/data/Card';
import { copy } from '../copy';
import { GROUPS, formatMetric, metricsOf } from '../model/metrics';
import type { Report } from '../model/types';
import { Delta } from './Delta';
import { MetricHint } from './DirectionBadge';

/** Every KPI of the board under its heading, one line each (shown on demand: the page leads with the five that matter). */
export function AllKpis({ report }: { report: Report }) {
  return (
    <Card>
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
        {GROUPS.map((g) => (
          <div key={g.id}>
            <p className="mb-1 text-xs font-medium tracking-wide text-quaternary uppercase">
              {g.label}
              <span className="ml-2 font-normal tracking-normal normal-case">{g.blurb}</span>
            </p>
            <ul className="divide-y divide-secondary">
              {metricsOf(g.id).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <span className="flex min-w-0 items-center gap-0.5 text-secondary">
                    <span className="truncate">{m.label}</span>
                    <MetricHint metric={m} />
                    <span className="text-xs text-quaternary">{m.better === 'higher' ? '↑' : '↓'}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <Delta
                      metric={m}
                      value={report.fleet[m.id]}
                      previous={report.previous?.[m.id] ?? null}
                      label=""
                      className="text-[11px] [&>span]:hidden"
                    />
                    <span className="w-20 text-right font-semibold tabular-nums text-primary">
                      {formatMetric(m, report.fleet[m.id])}
                      <span className="ml-0.5 text-xs font-normal text-tertiary">{m.unit}</span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-tertiary">{copy.all.note}</p>
    </Card>
  );
}
