import { ArrowDown, ArrowUp } from '@untitledui/icons';
import { cx } from '@/utils/cx';
import { copy } from '../copy';
import { change } from '../model/derive';
import type { MetricDef } from '../model/metrics';

/** How a figure moved against the period before, green when it moved to the better side of ITS metric (so a falling wait time is green). */
export function Delta({ metric, value, previous, label, className }: { metric: MetricDef; value: number | null; previous: number | null; label: string; className?: string }) {
  const d = change(metric, value, previous); if (!d) return null;
  return (
    <span className={cx('inline-flex items-center gap-0.5 text-xs font-medium whitespace-nowrap', d.improved === null ? 'text-tertiary' : d.improved ? 'text-fg-success-primary' : 'text-fg-error-primary', className)}>
      {d.pct > 0 ? <ArrowUp className="size-3" /> : d.pct < 0 ? <ArrowDown className="size-3" /> : null}{d.improved === null ? copy.card.same : `${Math.abs(d.pct).toFixed(0)}%`}<span className="font-normal text-tertiary"> {copy.card.vs(label)}</span>
    </span>
  );
}
