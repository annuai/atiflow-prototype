import { cx } from '@/utils/cx';

/** Plain vertical bars (one per bucket) with a label under the first, middle and last; no chart library. `title` of each bar is its value. */
export function Bars({
  values,
  labels,
  height = 120,
  color = 'bg-fg-brand-primary',
}: {
  values: number[];
  labels: string[];
  height?: number;
  color?: string;
}) {
  const max = Math.max(1, ...values);
  const show = (i: number) => i === 0 || i === values.length - 1 || i === Math.floor(values.length / 2);
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }} role="img" aria-label={values.join(', ')}>
        {values.map((v, i) => (
          <div
            key={i}
            title={`${labels[i]}: ${v}`}
            className={cx('min-w-[3px] flex-1 rounded-t-sm', v ? color : 'bg-quaternary')}
            style={{ height: v ? `${Math.max(4, (v / max) * 100)}%` : 2 }}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-[3px] text-[11px] text-tertiary">
        {labels.map((l, i) => (
          <span key={i} className="min-w-[3px] flex-1 overflow-visible text-center whitespace-nowrap">
            {show(i) ? l : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
