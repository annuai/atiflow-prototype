import { Label } from '@/components/base/input/label';
import { cx } from '@/utils/cx';
import { PALETTE } from '../model/structure/palette';

/**
 * A colour for an element: the preset palette (soft colours that read well behind a label), a crossed swatch for "use the kind's colour" (when `inherit` is given), and a custom
 * colour box. Returns `#rrggbb`, or undefined for the crossed swatch.
 */
export function ColorPicker({
  label,
  value,
  onChange,
  inherit,
  custom,
  disabled,
}: {
  label: string;
  value: string | undefined;
  onChange(v: string | undefined): void;
  /** text of the "use the kind colour" swatch; omit when a colour is always needed */
  inherit?: string;
  custom: string;
  disabled?: boolean;
}) {
  const swatch = (on: boolean) =>
    cx(
      'size-7 cursor-pointer rounded-full ring-1 ring-secondary outline-focus-ring transition focus-visible:outline-2 disabled:cursor-default',
      on && 'ring-2 ring-offset-2 ring-brand',
    );
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label}>
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        {inherit && (
          <button
            type="button"
            disabled={disabled}
            aria-label={inherit}
            title={inherit}
            aria-pressed={value === undefined}
            className={cx(swatch(value === undefined), 'grid place-items-center bg-primary text-fg-quaternary')}
            onClick={() => onChange(undefined)}
          >
            <span className="block h-px w-5 rotate-45 bg-current" />
          </button>
        )}
        {PALETTE.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            aria-label={p.color}
            title={p.color}
            aria-pressed={value === p.color}
            className={swatch(value === p.color)}
            style={{ background: p.color }}
            onClick={() => onChange(p.color)}
          />
        ))}
        <label className={cx(swatch(false), 'relative block overflow-hidden', disabled && 'opacity-50')} title={custom}>
          <input
            type="color"
            aria-label={custom}
            disabled={disabled}
            value={value ?? '#9aa6a2'}
            className="absolute inset-0 size-full cursor-pointer border-0 p-0 opacity-0"
            onChange={(e) => onChange(e.target.value)}
          />
          <span
            className="block size-full rounded-full"
            style={{ background: 'conic-gradient(#fda4af, #fcd34d, #86efac, #7dd3fc, #c4b5fd, #fda4af)' }}
          />
        </label>
      </div>
    </div>
  );
}
