import { HelpCircle } from '@untitledui/icons';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { cx } from '@/utils/cx';
import { copy } from '../copy';
import { insights } from '../insightsCopy';
import type { MetricDef } from '../model/metrics';

/** The (i) next to a title: what the metric means and how it is measured. */
export const MetricHint = ({ metric }: { metric: MetricDef }) => (
  <ButtonUtility
    size="xs"
    color="tertiary"
    icon={HelpCircle}
    tooltip={insights.reports.hint(metric.definition, metric.measuredBy)}
    aria-label={`${metric.label}: ${insights.reports.hint(metric.definition, metric.measuredBy)}`}
  />
);

/** The annotation that goes with every number, kept small: is a higher or a lower value the good one? */
export const BetterHint = ({ metric, className }: { metric: MetricDef; className?: string }) => (
  <span className={cx('text-[11px] whitespace-nowrap text-quaternary', className)}>
    {metric.better === 'higher' ? '↑' : '↓'} {copy.better[metric.better].toLowerCase()}
  </span>
);
