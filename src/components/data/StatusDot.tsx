import type { CSSProperties } from 'react';
import { cx } from '@/utils/cx';

/** What a dot says: success = online / free / running, brand = new / marked, neutral = off / idle, danger = failing; or any `color` (a fleet, a chart series). */
export type DotTone = 'success' | 'brand' | 'neutral' | 'danger';
const TONE: Record<DotTone, string> = {
  success: 'bg-success-solid',
  brand: 'bg-brand-solid',
  neutral: 'bg-fg-quaternary',
  danger: 'bg-error-solid',
};

/**
 * THE small status dot: a coloured circle before a label (online, free, a legend swatch, a fleet's colour). One component, so the sizes, the tones and the "decorative, hidden from a
 * screen reader" rule are the same everywhere. `size` md = 8 px, sm = 6 px; `ring` adds the soft halo of a live indicator; pass `label` when the dot is the only thing that says it.
 */
export function StatusDot({
  tone,
  color,
  size = 'md',
  ring,
  label,
  className,
}: {
  tone?: DotTone;
  color?: string;
  size?: 'sm' | 'md';
  ring?: boolean;
  label?: string;
  className?: string;
}) {
  const style: CSSProperties | undefined = color ? { background: color } : undefined;
  return (
    <i
      className={cx(
        'inline-block shrink-0 rounded-full',
        size === 'md' ? 'size-2' : 'size-1.5',
        tone && TONE[tone],
        ring && 'ring-2 ring-success-solid/30',
        className,
      )}
      style={style}
      {...(label ? { role: 'img', 'aria-label': label, title: label } : { 'aria-hidden': true })}
    />
  );
}
