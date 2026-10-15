import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export const Z_MIN = 0.25,
  Z_MAX = 2;
const KEEP = 160; // px of the workflow that always stays on screen
interface Cam {
  x: number;
  y: number;
  z: number;
}

/**
 * Pan / zoom camera for the workflow canvas.
 * Mouse: drag empty space = pan, wheel = pan, Ctrl/Cmd+wheel = zoom at cursor. Trackpad: two-finger pan, pinch zoom.
 * Touch: one finger on empty space = pan, two fingers = pinch zoom + pan. Keys: Ctrl +/-/0. Anything inside [data-no-pan] keeps its own gestures.
 */
export function useCamera(canvasRef: RefObject<HTMLDivElement | null>, innerRef: RefObject<HTMLDivElement | null>) {
  const cam = useRef<Cam>({ x: 24, y: 0, z: 1 });
  const [zoom, setZoomState] = useState(1);
  const inited = useRef(false);
  const glide = useRef(0);

  const apply = useCallback(() => {
    const c = canvasRef.current,
      inner = innerRef.current;
    if (!c || !inner) return;
    const k = cam.current;
    k.x = Math.min(c.clientWidth - KEEP, Math.max(KEEP - inner.offsetWidth * k.z, k.x));
    k.y = Math.min(c.clientHeight - KEEP, Math.max(KEEP - inner.offsetHeight * k.z, k.y));
    inner.style.transform = `translate(${k.x}px, ${k.y}px) scale(${k.z})`;
    c.style.backgroundSize = `${12 * k.z}px ${12 * k.z}px`;
    c.style.backgroundPosition = `${k.x}px ${k.y}px`;
    setZoomState((z) => (Math.abs(z - k.z) > 1e-4 ? k.z : z));
  }, [canvasRef, innerRef]);

  const setZoomAt = useCallback(
    (z: number, px?: number, py?: number) => {
      const c = canvasRef.current;
      if (!c) return;
      const k = cam.current;
      const nz = Math.min(Z_MAX, Math.max(Z_MIN, z));
      if (Math.abs(nz - k.z) < 1e-4) return;
      const x = px ?? c.clientWidth / 2,
        y = py ?? c.clientHeight / 2;
      k.x = x - ((x - k.x) * nz) / k.z;
      k.y = y - ((y - k.y) * nz) / k.z;
      k.z = nz;
      apply();
    },
    [apply, canvasRef],
  );

  /** Largest zoom (<=1, >=0.45) that fits the workflow height between the palette and the AI bar; left aligned. */
  const fit = useCallback(() => {
    const c = canvasRef.current,
      inner = innerRef.current;
    if (!c || !inner || !inner.offsetHeight) return;
    const pal = c.querySelector<HTMLElement>('[data-wf-palette]'),
      ai = c.querySelector<HTMLElement>('[data-wf-ai]');
    const top = (pal ? pal.offsetTop + pal.offsetHeight : 0) + 16,
      bottom = c.clientHeight - (ai ? ai.offsetHeight + 20 : 0) - 36;
    const z = Math.round(Math.min(1, Math.max(0.45, (bottom - top) / inner.offsetHeight)) * 20) / 20;
    const ch = inner.offsetHeight * z;
    cam.current = { z, x: 24, y: Math.max(top, top + (bottom - top - ch) / 2) };
    apply();
  }, [apply, canvasRef, innerRef]);

  /** Bring an element into view (newly added node, or the node the simulation is on). */
  const reveal = useCallback(
    (el: Element | null, avoidRight = 0) => {
      const c = canvasRef.current,
        inner = innerRef.current;
      if (!c || !inner || !el) return;
      const r = el.getBoundingClientRect(),
        f = c.getBoundingClientRect();
      const left = f.left + 24,
        right = f.right - 24 - avoidRight,
        top = f.top + 20,
        bottom = f.bottom - 90;
      let dx = 0,
        dy = 0;
      if (r.left < left || r.right > right) dx = (left + right) / 2 - (r.left + r.width / 2);
      if (r.height < bottom - top) {
        if (r.top < top) dy = top - r.top;
        else if (r.bottom > bottom) dy = bottom - r.bottom;
      }
      if (!dx && !dy) return;
      cam.current.x += dx;
      cam.current.y += dy;
      inner.style.transition = 'transform .35s ease';
      apply();
      window.clearTimeout(glide.current);
      glide.current = window.setTimeout(() => {
        inner.style.transition = '';
      }, 380);
    },
    [apply, canvasRef, innerRef],
  );

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    // wheel: pan, Ctrl/Cmd (and trackpad pinch) zoom at the cursor
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('[data-no-pan]')) return;
      e.preventDefault();
      const r = c.getBoundingClientRect();
      const k = cam.current;
      if (e.ctrlKey || e.metaKey) {
        const d = Math.max(-50, Math.min(50, e.deltaMode ? e.deltaY * 16 : e.deltaY));
        setZoomAt(k.z * Math.exp(-d * 0.006), e.clientX - r.left, e.clientY - r.top);
        return;
      }
      let dx = e.deltaX,
        dy = e.deltaY;
      if (e.deltaMode === 1) {
        dx *= 16;
        dy *= 16;
      }
      if (e.shiftKey && !dx) {
        dx = dy;
        dy = 0;
      }
      k.x -= dx;
      k.y -= dy;
      apply();
    };
    // pointers: drag to pan, two pointers to pinch
    const pts = new Map<number, { x: number; y: number }>();
    let pan: { x: number; y: number; cx: number; cy: number; on: boolean } | null = null;
    let pinch: { d: number; z: number } | null = null;
    const dist = () => {
      const [a, b] = [...pts.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const mid = () => {
      const [a, b] = [...pts.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };
    const down = (e: PointerEvent) => {
      if ((e.button !== 0 && e.pointerType === 'mouse') || (e.target as HTMLElement).closest('[data-no-pan]')) return;
      if (e.pointerType !== 'touch' && (e.target as HTMLElement).closest('.wf-node')) return; // a mouse press on a card selects it or drags it, it never pans the canvas
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); // (the pointer is captured only once a pan really starts, so a plain click still reaches the card and its buttons)
      if (pts.size === 1) pan = { x: e.clientX, y: e.clientY, cx: cam.current.x, cy: cam.current.y, on: false };
      else if (pts.size === 2) {
        pan = null;
        pinch = { d: dist(), z: cam.current.z };
      }
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.size === 2 ? mid() : null;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && pinch) {
        const m = mid(),
          r = c.getBoundingClientRect();
        const k = cam.current;
        if (prev) {
          k.x += m.x - prev.x;
          k.y += m.y - prev.y;
        }
        setZoomAt(pinch.z * (dist() / pinch.d), m.x - r.left, m.y - r.top);
        return;
      }
      if (pan) {
        const dx = e.clientX - pan.x,
          dy = e.clientY - pan.y;
        if (!pan.on) {
          if (Math.hypot(dx, dy) < 3) return;
          pan.on = true;
          c.classList.add('panning');
          try {
            c.setPointerCapture(e.pointerId);
          } catch {
            /* synthetic */
          }
        }
        cam.current.x = pan.cx + dx;
        cam.current.y = pan.cy + dy;
        apply();
      }
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (!pts.size) {
        pan = null;
        c.classList.remove('panning');
      }
    };
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement).closest('input, textarea')) return;
      const z = cam.current.z;
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setZoomAt(z + 0.1);
      } else if (e.key === '-') {
        e.preventDefault();
        setZoomAt(z - 0.1);
      } else if (e.key === '0') {
        e.preventDefault();
        setZoomAt(1);
      }
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    document.addEventListener('keydown', key);
    return () => {
      c.removeEventListener('wheel', onWheel);
      c.removeEventListener('pointerdown', down);
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up);
      c.removeEventListener('pointercancel', up);
      document.removeEventListener('keydown', key);
    };
  }, [apply, canvasRef, setZoomAt]);

  const ensureFit = useCallback(() => {
    if (!inited.current && innerRef.current?.offsetHeight) {
      inited.current = true;
      fit();
    } else apply();
  }, [apply, fit, innerRef]);
  const resetFit = useCallback(() => {
    inited.current = false;
  }, []);
  const panBy = useCallback(
    (dx: number, dy: number) => {
      cam.current.x += dx;
      cam.current.y += dy;
      apply();
    },
    [apply],
  );
  const getZoom = useCallback(() => cam.current.z, []);
  return {
    zoom,
    panBy,
    getZoom,
    zoomIn: () => setZoomAt(Math.round((cam.current.z + 0.1) * 10) / 10),
    zoomOut: () => setZoomAt(Math.round((cam.current.z - 0.1) * 10) / 10),
    setZoom: setZoomAt,
    fit,
    reveal,
    ensureFit,
    resetFit,
    apply,
  };
}
