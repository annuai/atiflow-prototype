import { Minus, Plus } from '@untitledui/icons';
import { cx } from '@/utils/cx';

/** − / value / + with 48 px touch targets (tablet convention: no typing needed). Hold-free: one tap, one step. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 999,
  step = 1,
  label = 'Quantity',
  className,
}: {
  value: number;
  onChange(v: number): void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  className?: string;
}) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  const btn =
    'grid size-12 shrink-0 place-items-center rounded-xl border border-primary bg-primary text-secondary shadow-xs outline-focus-ring transition active:scale-95 focus-visible:outline-2 disabled:opacity-40';
  return (
    <div className={cx('inline-flex items-center gap-2', className)} role="group" aria-label={label}>
      <button
        type="button"
        className={btn}
        aria-label={`Decrease ${label.toLowerCase()}`}
        disabled={value <= min}
        onClick={() => set(value - step)}
      >
        <Minus className="size-5" />
      </button>
      <output className="min-w-12 text-center text-lg font-semibold tabular-nums text-primary" aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className={btn}
        aria-label={`Increase ${label.toLowerCase()}`}
        disabled={value >= max}
        onClick={() => set(value + step)}
      >
        <Plus className="size-5" />
      </button>
    </div>
  );
}
