import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }
const MAX_ZOOM = 24;

/**
 * Pan and zoom of a plan drawn in an SVG: the view box has the aspect of its container, so the whole floor fits at zoom 1 and one pixel is the same length everywhere.
 * Site coordinates (x east, y north, metres) become SVG coordinates `(x - minX, maxY - y)`; `toSite` turns a pointer position back into site coordinates.
 */
export function useViewport(b: Bounds) {
  const W = b.maxX - b.minX, H = b.maxY - b.minY; const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 500 }); const [z, setZ] = useState(1); const [c, setC] = useState({ x: W / 2, y: H / 2 });
  useEffect(() => { const el = box.current; if (!el) return; const ro = new ResizeObserver(() => setSize({ w: Math.max(80, el.clientWidth), h: Math.max(80, el.clientHeight) })); ro.observe(el); return () => ro.disconnect(); }, []);
  const fit = Math.max(W / size.w, H / size.h) * 1.06; const vw = (size.w * fit) / z, vh = (size.h * fit) / z; const vx = c.x - vw / 2, vy = c.y - vh / 2; const u = vw / size.w;          // u = metres per pixel
  const clamp = useCallback((x: number, y: number) => ({ x: Math.min(W, Math.max(0, x)), y: Math.min(H, Math.max(0, y)) }), [W, H]);
  const zoomAt = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const nz = Math.min(MAX_ZOOM, Math.max(1, z * factor)); if (nz === z || !box.current) return; const r = box.current.getBoundingClientRect();
    const fx = clientX === undefined ? 0.5 : (clientX - r.left) / r.width, fy = clientY === undefined ? 0.5 : (clientY - r.top) / r.height; const wx = vx + vw * fx, wy = vy + vh * fy, nvw = (size.w * fit) / nz, nvh = (size.h * fit) / nz;
    setZ(nz); setC(clamp(wx - nvw * (fx - 0.5), wy - nvh * (fy - 0.5)));
  }, [z, vx, vy, vw, size, fit, clamp]);
  const panBy = useCallback((dxPx: number, dyPx: number) => setC((o) => clamp(o.x - dxPx * u, o.y - dyPx * u)), [clamp, u]);
  /** Centre on a point and zoom so something `span` metres wide fills about 40% of the view (a point gets a close-up). */
  const focusOn = useCallback((x: number, y: number, span: number) => {
    setZ(Math.min(MAX_ZOOM, Math.max(1, Math.min(size.w * fit, size.h * fit) / Math.max(12, span * 2.5)))); setC(clamp(x - b.minX, b.maxY - y));
  }, [size, fit, clamp, b.minX, b.maxY]);
  const reset = useCallback(() => { setZ(1); setC({ x: W / 2, y: H / 2 }); }, [W, H]);
  const toSite = useCallback((clientX: number, clientY: number) => {
    const r = box.current!.getBoundingClientRect(); return { x: b.minX + vx + vw * ((clientX - r.left) / r.width), y: b.maxY - (vy + vh * ((clientY - r.top) / r.height)) };
  }, [b.minX, b.maxY, vx, vy, vw, vh]);
  // the page must not scroll or zoom while the pointer is over the map
  useEffect(() => { const el = box.current; if (!el) return; const stop = (e: WheelEvent) => e.preventDefault(); el.addEventListener('wheel', stop, { passive: false }); return () => el.removeEventListener('wheel', stop); }, []);
  return useMemo(() => ({ box, size, zoom: z, u, viewBox: `${vx} ${vy} ${vw} ${vh}`, zoomAt, panBy, reset, focusOn, toSite, P: (x: number, y: number) => `${(x - b.minX).toFixed(2)} ${(b.maxY - y).toFixed(2)}`, X: (x: number) => x - b.minX, Y: (y: number) => b.maxY - y }), [size, z, u, vx, vy, vw, vh, zoomAt, panBy, reset, focusOn, toSite, b.minX, b.maxY]);
}
