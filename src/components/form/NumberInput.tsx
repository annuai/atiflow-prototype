import { useEffect, useId, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { useSyncedState } from '@/hooks/use-synced-state';
import { Input } from '@/components/base/input/input';
import { cx } from '@/utils/cx';
import { setScrubKey } from './scrub';

/** How far (px) the pointer moves for one step while dragging a label, and how many steps Shift makes of it. */
const PX_PER_STEP = 4;
const SHIFT_STEPS = 10;

/**
 * A number box (shared by the Map Editor and any form that needs one) that edits as text and commits on blur / Enter (an unreadable value goes back to what it was). Used for positions, sizes, angles. Like Figma, dragging its LABEL left or right
 * changes the value in whole numbers (one step for every few pixels, ten with Shift) and the map follows as you drag; the whole drag is one undo step.
 */
export function NumberInput({
  label,
  value,
  onCommit,
  disabled,
  error,
  hint,
  integer,
  className,
  tooltip,
}: {
  tooltip?: string;
  label: string;
  value: number;
  onCommit(v: number): void;
  disabled?: boolean;
  error?: string;
  hint?: string;
  integer?: boolean;
  className?: string;
}) {
  const [text, setText] = useSyncedState(String(value));
  const id = useId();
  const latest = useRef({ value, onCommit });
  useEffect(() => {
    latest.current = { value, onCommit };
  });
  const commit = () => {
    const n = parseFloat(text);
    if (Number.isFinite(n) && (!integer || Number.isInteger(n))) {
      if (n !== value) onCommit(n);
    } else setText(String(value));
  };
  const scrub = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0 || !(e.target as HTMLElement).closest('[data-label]')) return;
    e.preventDefault(); // no text selection while dragging (a click without moving still focuses the box)
    const x0 = e.clientX,
      v0 = Math.round(latest.current.value);
    let moved = false;
    const style = document.createElement('style'); // the whole page shows the resize cursor while dragging
    style.textContent = '* { cursor: col-resize !important; user-select: none !important; }';
    const move = (ev: PointerEvent) => {
      const steps = Math.trunc((ev.clientX - x0) / PX_PER_STEP) * (ev.shiftKey ? SHIFT_STEPS : 1);
      if (!moved && !steps) return;
      if (!moved) {
        moved = true;
        document.head.appendChild(style);
        setScrubKey(`scrub:${id}:${Date.now()}`); // a new key for every drag, so two drags are two undo steps
      }
      const next = v0 + steps;
      if (next !== latest.current.value) {
        setText(String(next));
        latest.current.onCommit(next);
      }
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      style.remove();
      setScrubKey(undefined);
      if (moved) (document.activeElement as HTMLElement | null)?.blur?.();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };
  return (
    <div
      onPointerDown={scrub}
      className={cx(!disabled && '[&_[data-label]]:cursor-col-resize', className)}
      data-scrub={disabled ? undefined : ''}
    >
      <Input
        label={label}
        tooltip={tooltip}
        size="sm"
        inputMode="decimal"
        value={text}
        isDisabled={disabled}
        isInvalid={!!error}
        hint={error ?? hint}
        onChange={setText}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}
