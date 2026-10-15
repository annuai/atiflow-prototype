import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { wfStore } from '../model/store';
import type { NodeTypeId } from '../model/types';

interface Opts {
  canvasRef: RefObject<HTMLDivElement | null>;
  flowRef: RefObject<HTMLDivElement | null>;
  getZoom: () => number;
  panBy: (dx: number, dy: number) => void;
}
const THRESHOLD = 6;

/**
 * Pointer-based drag & drop for the workflow canvas (one code path for mouse, pen and touch):
 *  - palette tile -> drop on a gap/branch to add (a plain tap/click adds at the end of the main flow)
 *  - node card -> drop on a gap to reorder or move into a branch
 * Gaps are elements marked [data-gap-list][data-gap-index]; the nearest one lights up via data-drop.
 */
export function useBuilderDnd({ canvasRef, flowRef, getZoom, panBy }: Opts) {
  const drop = useRef<HTMLElement | null>(null);
  const ghost = useRef<HTMLElement | null>(null);
  const mark = (el: HTMLElement | null) => {
    if (drop.current === el) return;
    drop.current?.removeAttribute('data-drop');
    drop.current = el;
    el?.setAttribute('data-drop', 'true');
  };
  const nearest = (x: number, y: number) => {
    let best: HTMLElement | null = null,
      bd = Infinity;
    flowRef.current?.querySelectorAll<HTMLElement>('[data-gap-list]').forEach((c) => {
      const r = c.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - x, (r.top + r.height / 2 - y) * 1.6);
      if (d < bd) {
        bd = d;
        best = c;
      }
    });
    return best as HTMLElement | null;
  };
  const inside = (x: number, y: number) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return !!r && x > r.left && x < r.right && y > r.top && y < r.bottom;
  };
  const edgeScroll = (x: number, y: number) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r || !inside(x, y)) return;
    if (x > r.right - 48) panBy(-14, 0);
    else if (x < r.left + 48) panBy(14, 0);
  };
  const cleanup = () => {
    ghost.current?.remove();
    ghost.current = null;
    mark(null);
    document.body.classList.remove('wf-dragging');
  };
  const active = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      active.current?.();
      cleanup();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** Shared gesture loop. `begin` builds the ghost once the pointer moved far enough; `commit` runs on drop. */
  const run = (
    e: React.PointerEvent,
    begin: () => HTMLElement | null,
    onClick: (() => void) | null,
    commit: (list: string, gap: number) => void,
  ) => {
    const sx = e.clientX,
      sy = e.clientY,
      id = e.pointerId;
    let dragging = false;
    let ox = 0,
      oy = 0;
    const move = (m: PointerEvent) => {
      if (m.pointerId !== id) return;
      if (!dragging) {
        if (Math.hypot(m.clientX - sx, m.clientY - sy) < THRESHOLD) return;
        const g = begin();
        if (!g) {
          off();
          return;
        }
        ghost.current = g;
        document.body.appendChild(g);
        document.body.classList.add('wf-dragging');
        dragging = true;
        const r = g.getBoundingClientRect();
        ox = r.width / 2;
        oy = Math.min(24, r.height / 2);
      }
      const z = getZoom();
      const sc = g_scale(ghost.current);
      ghost.current!.style.transform = `translate(${m.clientX - ox}px, ${m.clientY - oy}px) scale(${sc ?? z})`;
      mark(inside(m.clientX, m.clientY) ? nearest(m.clientX, m.clientY) : null);
      edgeScroll(m.clientX, m.clientY);
    };
    const up = (u: PointerEvent) => {
      if (u.pointerId !== id) return;
      const g = drop.current;
      const was = dragging;
      off();
      if (was && g) commit(g.dataset.gapList!, +(g.dataset.gapIndex ?? 0));
      else if (!was) onClick?.();
      cleanup();
    };
    const cancel = (c: PointerEvent) => {
      if (c.pointerId === id) {
        off();
        cleanup();
      }
    };
    const off = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      active.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    active.current = off;
  };
  const g_scale = (el: HTMLElement | null) => (el?.dataset.scale ? +el.dataset.scale : null);

  /** Palette tile: drag (mouse/pen) to place, tap/click to append. On touch the palette scrolls, so touch only taps. */
  const startPaletteDrag = useCallback((e: React.PointerEvent, type: NodeTypeId | 'aiot', tile: HTMLElement) => {
    if (e.button !== 0) return;
    if (e.pointerType === 'touch' || type === 'aiot') {
      return;
    } // handled by onClick
    run(
      e,
      () => {
        const g = tile.cloneNode(true) as HTMLElement;
        g.classList.add('wf-ghost');
        g.style.width = tile.offsetWidth + 'px';
        g.dataset.scale = '1';
        return g;
      },
      () => wfStore.getState().addNode(type),
      (list, gap) => wfStore.getState().addNode(type, list, gap),
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Node card: mouse drags from anywhere that is not a control; touch drags only from the handle. */
  const startCardDrag = useCallback((e: React.PointerEvent, id: string, card: HTMLElement) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest('input, [role=combobox], button:not([data-drag-handle]), [role=checkbox], label')) return;
    if (e.pointerType === 'touch' && !t.closest('[data-drag-handle]')) return;
    run(
      e,
      () => {
        const g = card.cloneNode(true) as HTMLElement;
        g.classList.add('wf-ghost');
        g.removeAttribute('data-node-id');
        g.style.width = card.offsetWidth + 'px';
        card.setAttribute('data-dragging', 'true');
        document.body.dataset.wfDragId = id;
        return g;
      },
      null,
      (list, gap) => wfStore.getState().moveNode(id, list, gap),
    );
    const clear = () => {
      card.removeAttribute('data-dragging');
      window.removeEventListener('pointerup', clear);
      window.removeEventListener('pointercancel', clear);
    };
    window.addEventListener('pointerup', clear);
    window.addEventListener('pointercancel', clear);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { startPaletteDrag, startCardDrag };
}
