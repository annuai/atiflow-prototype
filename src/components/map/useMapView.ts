import { useCallback, useEffect, useRef, useState } from 'react';

/** Where a flat map is looking: zoom (1 = the whole floor fits) and the centre of the view in map units. */
export interface MapView {
  z: number;
  cx: number;
  cy: number;
}

/** How much one wheel / trackpad event zooms. A mouse notch (deltaY 100) is about 1.5x, a trackpad pinch (ctrl + tiny deltas, many per second) follows the fingers, and a line-based wheel is scaled up. */
export function wheelZoomFactor(e: { deltaY: number; deltaMode: number; ctrlKey: boolean }): number {
  const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
  const k = e.ctrlKey ? 0.012 : 0.004; // pinch on a trackpad arrives as ctrl + wheel with small deltas
  return Math.exp(-Math.max(-250, Math.min(250, px)) * k);
}
/** One animation step toward a target zoom, in the log domain so zooming in and out feel the same; frame-rate independent (`ms` since the last frame). */
export function zoomStep(z: number, target: number, ms: number, tauMs = 70): number {
  const d = Math.log(target) - Math.log(z);
  if (Math.abs(d) < 0.002) return target;
  return Math.exp(Math.log(z) + d * (1 - Math.exp(-Math.max(1, ms) / tauMs)));
}

interface Geo {
  W: number;
  H: number;
  size: { w: number; h: number };
  fit: number;
  maxZoom: number;
}
const extentOf = (g: Geo, z: number) => ({ vw: (g.size.w * g.fit) / z, vh: (g.size.h * g.fit) / z });
const clampOf = (g: Geo, x: number, y: number) => ({
  cx: Math.min(g.W, Math.max(0, x)),
  cy: Math.min(g.H, Math.max(0, y)),
});

interface Opts {
  /** the container: wheel and trackpad gestures are taken here (the page must not scroll or zoom while the pointer is over the map) */
  el: HTMLElement | null;
  W: number;
  H: number;
  /** container size in pixels and the view-box fit factor (map units per pixel at zoom 1) */
  size: { w: number; h: number };
  fit: number;
  maxZoom?: number;
}

/**
 * The zoom and pan state of EVERY flat map (Map Editor, workflow / Book trip map), so they feel the same. Why it exists as one hook:
 * - the truth lives in a ref, so several wheel or pointer events in one frame add up (they used to read the same stale state and overwrite each other, which made zooming feel slow and jumpy);
 * - React is told once per animation frame, however many events came in;
 * - wheel, trackpad pinch and the + / - buttons glide to the new zoom while the point under the cursor stays under it; two-finger touch follows the fingers directly (no lag);
 * - Safari's trackpad pinch (gesture events) is handled too.
 */
export function useMapView({ el, W, H, size, fit, maxZoom = 24 }: Opts) {
  const live = useRef<MapView>({ z: 1, cx: W / 2, cy: H / 2 });
  const geo = useRef({ W, H, size, fit, maxZoom });
  useEffect(() => {
    geo.current = { W, H, size, fit, maxZoom };
  });
  const goal = useRef<{ z: number; wx: number; wy: number; fx: number; fy: number } | null>(null);
  const [view, setView] = useState<MapView>({ z: 1, cx: W / 2, cy: H / 2 });
  const raf = useRef(0);
  const last = useRef(0);

  const frameRef = useRef<(t: number) => void>(() => {});
  useEffect(() => {
    frameRef.current = (t: number) => {
      raf.current = 0;
      const g = goal.current;
      if (g) {
        const z = zoomStep(live.current.z, g.z, last.current ? t - last.current : 16);
        const { vw, vh } = extentOf(geo.current, z);
        live.current = { z, ...clampOf(geo.current, g.wx - vw * (g.fx - 0.5), g.wy - vh * (g.fy - 0.5)) };
        if (z === g.z) goal.current = null;
      }
      last.current = goal.current ? t : 0;
      setView({ ...live.current });
      if (goal.current) raf.current = requestAnimationFrame((n) => frameRef.current(n));
    };
  });
  const schedule = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame((t) => frameRef.current(t));
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  /** Zoom by `factor` around a screen point (the middle when omitted). `smooth` glides there (wheel, buttons); otherwise it follows at once (fingers). */
  const zoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number, smooth = false) => {
      if (!el) return;
      const g = geo.current;
      const base = smooth && goal.current ? goal.current.z : live.current.z;
      const nz = Math.min(g.maxZoom, Math.max(1, base * factor));
      const r = el.getBoundingClientRect();
      const fx = clientX === undefined ? 0.5 : (clientX - r.left) / r.width,
        fy = clientY === undefined ? 0.5 : (clientY - r.top) / r.height;
      const { vw, vh } = extentOf(g, live.current.z);
      const wx = live.current.cx - vw / 2 + vw * fx,
        wy = live.current.cy - vh / 2 + vh * fy; // the map point under the cursor now
      if (smooth) {
        if (nz === live.current.z && !goal.current) return;
        goal.current = { z: nz, wx, wy, fx, fy };
      } else {
        goal.current = null;
        if (nz === live.current.z) return;
        const n = extentOf(g, nz);
        live.current = { z: nz, ...clampOf(g, wx - n.vw * (fx - 0.5), wy - n.vh * (fy - 0.5)) };
      }
      schedule();
    },
    [el, schedule],
  );
  const panBy = useCallback(
    (dxPx: number, dyPx: number) => {
      goal.current = null;
      const g = geo.current;
      const u = extentOf(g, live.current.z).vw / g.size.w;
      live.current = { ...live.current, ...clampOf(g, live.current.cx - dxPx * u, live.current.cy - dyPx * u) };
      schedule();
    },
    [schedule],
  );
  /** Jump to a view (reset, locate). */
  const set = useCallback(
    (z: number, cx: number, cy: number) => {
      goal.current = null;
      live.current = { z: Math.min(geo.current.maxZoom, Math.max(1, z)), ...clampOf(geo.current, cx, cy) };
      schedule();
    },
    [schedule],
  );

  useEffect(() => {
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(wheelZoomFactor(e), e.clientX, e.clientY, true);
    };
    // Safari reports a trackpad pinch as gesture events with a running scale instead of ctrl + wheel
    let gestureScale = 1;
    const gStart = (e: Event) => {
      e.preventDefault();
      gestureScale = 1;
    };
    const gChange = (e: Event) => {
      e.preventDefault();
      const g = e as Event & { scale: number; clientX: number; clientY: number };
      zoomAt(g.scale / gestureScale, g.clientX, g.clientY);
      gestureScale = g.scale;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', gStart);
    el.addEventListener('gesturechange', gChange);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', gStart);
      el.removeEventListener('gesturechange', gChange);
    };
  }, [el, zoomAt]);

  return { view, zoomAt, panBy, set };
}
