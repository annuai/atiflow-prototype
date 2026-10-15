import { BarChartSquare02 } from '@untitledui/icons';
import { EmptyState } from '@/components/data/EmptyState';
import { ArrowDown, ArrowUp } from '@untitledui/icons';
import { Card, CardTitle } from '@/components/data/Card';
import { cx } from '@/utils/cx';
import { copy } from '../copy';
import type { Move } from '../model/derive';
import { withUnit } from '../model/metrics';

/** The biggest moves against the period before, worst first, so "what slipped" and "what got better" are one glance. */
export function WhatChanged({ moves, vs }: { moves: Move[]; vs: string }) {
  const worse = moves.filter((m) => !m.improved).slice(0, 3), better = moves.filter((m) => m.improved).slice(0, 3);
  return (
    <Card>
      <CardTitle title={copy.changed.title} hint={moves.length ? copy.changed.hint(vs) : undefined} />
      {!moves.length ? <EmptyState icon={BarChartSquare02} title={copy.changed.noneTitle} subtext={copy.changed.none} size="sm" /> : (
        <div className="flex flex-col gap-4">
          {([[copy.changed.slipped, worse], [copy.changed.improved, better]] as const).map(([title, rows]) => rows.length > 0 && (
            <div key={title}>
              <p className="mb-1 text-xs font-medium tracking-wide text-quaternary uppercase">{title}</p>
              <ul className="divide-y divide-secondary">
                {rows.map((r) => (
                  <li key={r.metric.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0"><span className="text-primary">{r.metric.label}</span><span className="block text-xs text-tertiary">{withUnit(r.metric, r.from)} → {withUnit(r.metric, r.to)}</span></span>
                    <span className={cx('inline-flex shrink-0 items-center gap-0.5 font-semibold', r.improved ? 'text-fg-success-primary' : 'text-fg-error-primary')}>{r.pct > 0 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}{Math.abs(r.pct).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
