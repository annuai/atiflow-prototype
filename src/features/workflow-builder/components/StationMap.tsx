import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, Home01 } from '@untitledui/icons';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import type { NavGraph, SiteLayout, Vec2 } from '@/core/types';

/**
 * The factory map as a plan (the same site and lane map the Live Floor shows, drawn flat as SVG): walls, machines, zones, lanes and the stations as pins. No robots: this is
 * the configurator. Stations the fleet can use are clickable when `pickable` (a Station or If Logic step is selected); `highlighted` ones carry a ring; `route` / `done` draw
 * the lane path of the simulated workflow. Drag to pan, wheel or the buttons to zoom.
 */
const TYPE_COLOR: Record<string, string> = { pick: '#0ea5e9', drop: '#f59e0b', buffer: '#8b5cf6', asrs: '#14b8a6' };
const MAX_ZOOM = 14;
export interface StationMapProps {
  site: SiteLayout; nav: NavGraph;
  /** Stations the open fleet may use (others are dimmed and cannot be picked). */
  usable: Set<string>; highlighted: string[]; pickable: boolean; onPick(stationId: string): void;
  /** Lane paths of the simulation: finished legs and the leg being driven. */
  done?: Vec2[][]; route?: Vec2[] | null;
  /** The robot of the simulation (a picture of the workflow, nothing is running): where it is and which way it faces (radians, site frame). */
  robot?: { p: Vec2; heading: number } | null;
}

export function StationMap({ site, nav, usable, highlighted, pickable, onPick, done = [], route = null, robot = null }: StationMapProps) {
  const { minX, maxX, minY, maxY } = site.bounds; const W = maxX - minX, H = maxY - minY, P = (x: number, y: number) => `${(x - minX).toFixed(1)} ${(maxY - y).toFixed(1)}`;
  const box = useRef<HTMLDivElement>(null); const [size, setSize] = useState({ w: 360, h: 520 }); const [z, setZ] = useState(1); const [c, setC] = useState({ x: W / 2, y: H / 2 }); const [hover, setHover] = useState<string | null>(null);
  useEffect(() => { const el = box.current; if (!el) return; const ro = new ResizeObserver(() => setSize({ w: Math.max(80, el.clientWidth), h: Math.max(80, el.clientHeight) })); ro.observe(el); return () => ro.disconnect(); }, []);
  // the view box has the aspect of the container, so the whole site fits at zoom 1 and pixels map to metres evenly
  const fit = Math.max(W / size.w, H / size.h) * 1.04; const vw = (size.w * fit) / z, vh = (size.h * fit) / z; const vx = c.x - vw / 2, vy = c.y - vh / 2;
  const clampC = (x: number, y: number) => ({ x: Math.min(W, Math.max(0, x)), y: Math.min(H, Math.max(0, y)) });

  const layers = useMemo(() => {
    const walls = site.walls.map((w) => `M${P(w.a[0], w.a[1])}L${P(w.b[0], w.b[1])}`).join('');
    const machines = site.equipment.map((e) => { const x = e.x - e.w / 2, y = e.y - e.d / 2; return `M${P(x, y)}L${P(x + e.w, y)}L${P(x + e.w, y + e.d)}L${P(x, y + e.d)}Z`; }).join('');
    const lanes = nav.lanes.map((l) => 'M' + l.geom.map(([x, y]) => P(x, y)).join('L')).join('');
    return { walls, machines, lanes };
  }, [site, nav]);                                                                               // eslint-disable-line react-hooks/exhaustive-deps

  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, moved: false }; };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) (e.currentTarget as Element).setPointerCapture(e.pointerId); d.moved = true; d.x = e.clientX; d.y = e.clientY; const k = vw / size.w; setC((o) => clampC(o.x - dx * k, o.y - dy * k));
  };
  const onUp = () => { setTimeout(() => { drag.current = null; }); };
  const zoomAt = (factor: number, px?: number, py?: number) => {
    const nz = Math.min(MAX_ZOOM, Math.max(1, z * factor)); if (nz === z) return; const r = box.current!.getBoundingClientRect(); const fx = px === undefined ? 0.5 : (px - r.left) / r.width, fy = py === undefined ? 0.5 : (py - r.top) / r.height;
    const wx = vx + vw * fx, wy = vy + vh * fy, nvw = (size.w * fit) / nz, nvh = (size.h * fit) / nz; setZ(nz); setC(clampC(wx - nvw * (fx - 0.5), wy - nvh * (fy - 0.5)));
  };
  const onWheel = (e: React.WheelEvent) => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); };
  useEffect(() => { const el = box.current; if (!el) return; const stop = (e: WheelEvent) => e.preventDefault(); el.addEventListener('wheel', stop, { passive: false }); return () => el.removeEventListener('wheel', stop); }, []);
  const reset = () => { setZ(1); setC({ x: W / 2, y: H / 2 }); };

  const u = vw / size.w;                                                      // metres per screen pixel: pins, labels and the robot keep their pixel size when zooming (like sections in Figma), so a cluster opens up as you zoom in
  const pin = (s: NavGraph['stations'][number]) => {
    const n = nav.nodes.find((q) => q.id === s.nodeId)!; const ok = usable.has(s.id), hl = highlighted.includes(s.id), click = pickable && ok; const col = TYPE_COLOR[s.type] ?? '#64748b'; const x = n.x - minX, y = maxY - n.y;
    return (
      <g key={s.id} transform={`translate(${x} ${y}) scale(${u})`} opacity={ok || hl ? 1 : 0.35} style={{ cursor: click ? 'pointer' : 'default' }} onPointerEnter={() => setHover(s.id)} onPointerLeave={() => setHover(null)}
        onClick={() => { if (click && !drag.current?.moved) onPick(s.id); }} role={click ? 'button' : undefined} aria-label={click ? `Pick ${s.id} ${s.name}` : undefined} data-station={s.id}>
        <title>{`${s.id} · ${s.name}${ok ? '' : ' (not on this fleet’s map)'}`}</title>
        {hl && <circle r={12} fill="#5eead4" opacity={0.35} />}{hl && <circle r={9} fill="none" stroke="#14b8a6" strokeWidth={1.6} />}
        <circle r={9} fill="transparent" />
        <circle r={4.5} fill={col} stroke="#fff" strokeWidth={1.4} />
        {(hl || click || hover === s.id || z >= 2.2) && <text x={8} y={3.5} fontSize={10} fontWeight={600} fill="#1f2937" paintOrder="stroke" stroke="#fff" strokeWidth={2.4}>{s.id.replace('STA-', '')}</text>}
      </g>
    );
  };
  const line = (pts: Vec2[]) => 'M' + pts.map((p) => P(p.x, p.y)).join('L');

  return (
    <div ref={box} className="relative size-full touch-none select-none overflow-hidden" data-no-pan onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <svg width="100%" height="100%" viewBox={`${vx} ${vy} ${vw} ${vh}`} role="img" aria-label="Factory map with stations" className={pickable ? 'cursor-crosshair' : 'cursor-grab'}>
        {site.zones.filter((q) => q.active).map((q) => <path key={q.id} d={'M' + q.polygon.map(([x, y]) => P(x, y)).join('L') + 'Z'} fill={q.color} fillOpacity={0.08} stroke={q.color} strokeOpacity={0.25} strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
        <path d={layers.machines} fill="#cbd5d1" fillOpacity={0.7} />
        <path d={layers.lanes} fill="none" stroke="#14b8a6" strokeOpacity={0.35} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
        <path d={layers.walls} fill="none" stroke="#475569" strokeWidth={1.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {done.map((d, i) => <path key={i} d={line(d)} fill="none" stroke="#14b8a6" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} vectorEffect="non-scaling-stroke" />)}
        {route && <path d={line(route)} fill="none" stroke="#0d9488" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="7 5" vectorEffect="non-scaling-stroke" />}
        {nav.stations.filter((s) => s.type !== 'park' && s.type !== 'charge').map(pin)}
        {robot && (
          <g transform={`translate(${(robot.p.x - minX).toFixed(2)} ${(maxY - robot.p.y).toFixed(2)}) scale(${u}) rotate(${(-robot.heading * 180) / Math.PI})`} aria-label="Robot" pointerEvents="none">
            <rect x={-9} y={-6} width={18} height={12} rx={3} fill="#fcd900" stroke="#111827" strokeWidth={1.4} />
            <rect x={4} y={-4.6} width={3.6} height={9.2} rx={1} fill="#111827" /><circle cx={-2} cy={0} r={2.4} fill="#f58a1f" />
          </g>
        )}
      </svg>
      <div className="absolute right-2 bottom-2 flex flex-col gap-1 rounded-lg bg-primary/90 p-1 shadow-sm ring-1 ring-secondary" data-no-pan onPointerDown={(e) => e.stopPropagation()}>
        <ButtonUtility size="xs" color="tertiary" icon={Plus} tooltip="Zoom in" aria-label="Zoom in" onPress={() => zoomAt(1.5)} />
        <ButtonUtility size="xs" color="tertiary" icon={Minus} tooltip="Zoom out" aria-label="Zoom out" onPress={() => zoomAt(1 / 1.5)} />
        <ButtonUtility size="xs" color="tertiary" icon={Home01} tooltip="Fit the whole map" aria-label="Fit the whole map" onPress={reset} />
      </div>
    </div>
  );
}
