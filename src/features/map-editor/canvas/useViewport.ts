import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMapView } from '@/components/map/useMapView';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
const MAX_ZOOM = 24;

/**
 * Pan and zoom of a plan drawn in an SVG: the view box has the aspect of its container, so the whole floor fits at zoom 1 and one pixel is the same length everywhere.
 * Site coordinates (x east, y north, metres) become SVG coordinates `(x - minX, maxY - y)`; `toSite` turns a pointer position back into site coordinates.
 */
export function useViewport(b: Bounds) {
  const W = b.maxX - b.minX,
    H = b.maxY - b.minY;
  // the container is kept in state through a callback ref: effects run when it appears, and no ref object is read while rendering
  const [el, box] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 600, h: 500 });
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: Math.max(80, el.clientWidth), h: Math.max(80, el.clientHeight) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  const fit = Math.max(W / size.w, H / size.h) * 1.06;
  const { view, zoomAt: zoomView, panBy, set } = useMapView({ el, W, H, size, fit, maxZoom: MAX_ZOOM });
  const z = view.z;
  const vw = (size.w * fit) / z,
    vh = (size.h * fit) / z;
  const vx = view.cx - vw / 2,
    vy = view.cy - vh / 2;
  const u = vw / size.w; // u = metres per pixel
  /** Zoom around a screen point; the buttons and the wheel glide, fingers (`smooth` false) follow at once. */
  const zoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number, smooth = false) => zoomView(factor, clientX, clientY, smooth),
    [zoomView],
  );
  /** Centre on a point and zoom so something `span` metres wide fills about 40% of the view (a point gets a close-up). */
  const focusOn = useCallback(
    (x: number, y: number, span: number) =>
      set(
        Math.min(MAX_ZOOM, Math.max(1, Math.min(size.w * fit, size.h * fit) / Math.max(12, span * 2.5))),
        x - b.minX,
        b.maxY - y,
      ),
    [size, fit, set, b.minX, b.maxY],
  );
  const reset = useCallback(() => set(1, W / 2, H / 2), [set, W, H]);
  const toSite = useCallback(
    (clientX: number, clientY: number) => {
      const r = el!.getBoundingClientRect();
      return {
        x: b.minX + vx + vw * ((clientX - r.left) / r.width),
        y: b.maxY - (vy + vh * ((clientY - r.top) / r.height)),
      };
    },
    [b.minX, b.maxY, vx, vy, vw, vh, el],
  );
  return useMemo(
    () => ({
      /** pass as the container's `ref` (a callback ref) */
      box,
      /** the container element once it exists */
      el,
      size,
      zoom: z,
      u,
      viewBox: `${vx} ${vy} ${vw} ${vh}`,
      zoomAt,
      panBy,
      reset,
      focusOn,
      toSite,
      P: (x: number, y: number) => `${(x - b.minX).toFixed(2)} ${(b.maxY - y).toFixed(2)}`,
      X: (x: number) => x - b.minX,
      Y: (y: number) => b.maxY - y,
    }),
    [el, size, z, u, vx, vy, vw, vh, zoomAt, panBy, reset, focusOn, toSite, b.minX, b.maxY],
  );
}
