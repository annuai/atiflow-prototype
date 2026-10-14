import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MOTION } from '@/components/motion/tokens';
import { cx } from '@/utils/cx';

/** One grey block with a soft shimmer (still under `prefers-reduced-motion`). Size and shape come from the classes: `<Skeleton className="h-4 w-40" />`. */
export const Skeleton = ({ className, style }: { className?: string; style?: CSSProperties }) => <div aria-hidden className={cx('skeleton rounded-md', className)} style={style} />;
/** n lines of text, the last one shorter. */
export const SkeletonText = ({ lines = 2, className }: { lines?: number; className?: string }) => (
  <div aria-hidden className={cx('flex flex-col gap-2', className)}>{Array.from({ length: lines }, (_, i) => <Skeleton key={i} className="h-3.5" style={{ width: i === lines - 1 && lines > 1 ? '60%' : '100%' }} />)}</div>
);
/** A white card (same box as the real cards) holding skeleton content. */
export const SkeletonCard = ({ className, children }: { className?: string; children?: ReactNode }) => <div aria-hidden className={cx('rounded-xl border border-secondary bg-primary p-5 shadow-xs', className)}>{children}</div>;

export type LoadPhase = 'blank' | 'skeleton' | 'ready';
/**
 * Decides what to show while something loads, so a fast load never flashes a skeleton and a slow one never blinks:
 * nothing for the first `delay` ms, then the skeleton, and once shown it stays at least `min` ms.
 */
export function useLoadPhase(loading: boolean, delay: number = MOTION.skeleton.delay, min: number = MOTION.skeleton.min): LoadPhase {
  const [shown, setShown] = useState(false); const since = useRef(0);
  useEffect(() => {
    if (loading) { const t = window.setTimeout(() => { since.current = Date.now(); setShown(true); }, delay); return () => window.clearTimeout(t); }
    if (!shown) return; const t = window.setTimeout(() => setShown(false), Math.max(0, min - (Date.now() - since.current))); return () => window.clearTimeout(t);
  }, [loading, delay, min]);          // eslint-disable-line react-hooks/exhaustive-deps
  return shown ? 'skeleton' : loading ? 'blank' : 'ready';
}
/** For a lazy page's fallback: renders its children only after `delay` ms (a page that arrives quickly never shows it). */
export function Delayed({ delay = MOTION.skeleton.delay, children }: { delay?: number; children: ReactNode }) {
  const [on, setOn] = useState(false); useEffect(() => { const t = window.setTimeout(() => setOn(true), delay); return () => window.clearTimeout(t); }, [delay]);
  return on ? <>{children}</> : null;
}
