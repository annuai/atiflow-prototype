import { useEffect, useRef, type RefObject } from 'react';

interface Pt {
  x: number;
  y: number;
}
/** One step of a two-finger gesture (pure): how much the fingers spread (`scale`, 1 = same) and how far their midpoint moved. */
export function pinchStep(before: [Pt, Pt], after: [Pt, Pt]): { scale: number; mid: Pt; dx: number; dy: number } {
  const dist = (p: [Pt, Pt]) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  const mid = (p: [Pt, Pt]) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
  const b = mid(before),
    a = mid(after);
  const d0 = dist(before);
  return { scale: d0 > 1 ? dist(after) / d0 : 1, mid: a, dx: a.x - b.x, dy: a.y - b.y };
}
export interface TouchState {
  pinching: boolean;
  /** when the last two-finger gesture ended (epoch ms): a tap right after it is not a tap */ lastAt: number;
}
/**
 * Two fingers zoom and move a flat map (pinch to zoom around the fingers, drag both to pan). Used by every map view, so they all behave the same on a touchscreen. Fingers are tracked with
 * pointer events on the container (which needs `touch-action: none`). While two fingers are down `pinching` is true: the map's own one-finger code (pan, draw, pick, drag) should ignore the
 * pointer; for a moment after the gesture ends `lastAt` is recent, so the finger lifting is not taken for a tap.
 */
export function useTouchGestures(
  box: RefObject<HTMLElement | null>,
  api: { zoomAt(factor: number, clientX: number, clientY: number): void; panBy(dxPx: number, dyPx: number): void },
) {
  const state = useRef<TouchState>({ pinching: false, lastAt: 0 });
  const fingers = useRef(new Map<number, Pt>());
  const apiRef = useRef(api);
  apiRef.current = api;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const f = fingers.current,
      s = state.current;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      f.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (f.size >= 2) s.pinching = true;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !f.has(e.pointerId)) return;
      if (!(s.pinching && f.size === 2)) {
        f.set(e.pointerId, { x: e.clientX, y: e.clientY });
        return;
      }
      const before = [...f.values()] as [Pt, Pt];
      f.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const after = [...f.values()] as [Pt, Pt];
      const step = pinchStep(before, after);
      if (step.scale !== 1) apiRef.current.zoomAt(step.scale, step.mid.x, step.mid.y);
      if (step.dx || step.dy) apiRef.current.panBy(step.dx, step.dy);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      f.delete(e.pointerId);
      if (s.pinching && f.size < 2) {
        s.pinching = false;
        s.lastAt = Date.now();
      }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      f.clear();
      s.pinching = false;
    };
  }, [box]);
  return state;
}
/** A touchscreen is the main input (phones, tablets): hit areas on maps are made bigger. */
export const isCoarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
/** True while a two-finger gesture runs or just ended: a map's one-finger code should do nothing. */
export const gestureBusy = (s: TouchState) => s.pinching || Date.now() - s.lastAt < 350;
