import { cx } from '@/utils/cx';
import { Sparkline } from '../charts/Sparkline';
import type { Kpi } from '../data/types';
import { Card } from './Cards';

const TONE: Record<Kpi['tone'], { text: string; line: string }> = {
  neutral: { text: 'text-primary', line: '#14b8a6' },
  good: { text: 'text-fg-success-primary', line: '#22c55e' },
  warn: { text: 'text-fg-warning-primary', line: '#f59e0b' },
  bad: { text: 'text-fg-error-primary', line: '#ef4444' },
};

/** Five numbers with a trend line each. The change is measured over the last few minutes of this page's own history, never against invented baselines. */
export function KpiRow({ kpis, tv }: { kpis: Kpi[]; tv?: boolean }) {
  return (
    <div className={cx('grid gap-3', tv ? 'grid-cols-5' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5')}>
      {kpis.map((k) => (
        <Card key={k.id} tv={tv} className="flex flex-col gap-1">
          <p className={cx('text-tertiary', tv ? 'text-base' : 'text-sm')}>{k.label}</p>
          <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
            <p className={cx('font-semibold tabular-nums', TONE[k.tone].text, tv ? 'text-5xl' : 'text-3xl')}>
              {k.value}
              {k.unit && <span className="text-[0.55em]">{k.unit}</span>}
              {k.of !== undefined && <span className="ml-1 text-[0.5em] font-normal text-tertiary">/ {k.of}</span>}
            </p>
            <Sparkline
              values={k.series}
              color={TONE[k.tone].line}
              width={tv ? 120 : 84}
              height={tv ? 40 : 28}
              className="shrink-0"
            />
          </div>
          <p className={cx('h-4 text-tertiary', tv ? 'text-sm' : 'text-xs')}>
            {k.trend === null
              ? ''
              : k.trend === 0
                ? 'No change in 5 min'
                : `${k.trend > 0 ? '▲' : '▼'} ${Math.abs(k.trend)}${k.unit ?? ''} in 5 min`}
          </p>
        </Card>
      ))}
    </div>
  );
}
