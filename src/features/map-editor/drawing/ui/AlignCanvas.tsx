import { memo, useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { applyPoint, type Similarity } from '@/core/similarity';
import { ZoomControls } from '../../canvas/layers/ZoomControls';
import { useSpacePan } from '../../canvas/useSpacePan';
import { useViewport } from '../../canvas/useViewport';
import { aboutCentre, invert, svgMatrix } from '../core/align';
import type { Area } from '../core/place';
import type { P } from '../core/types';
import type { MapContext } from '../mapContext';
import type { PreviewPaths } from './previewPaths';

const KIND_COLOR = {
  walls: '#0f766e',
  partitions: '#14b8a6',
  machines: '#b45309',
  pillars: '#7c3aed',
  doors: '#f59e0b',
  areas: '#2563eb',
};

/** The drawing's preview, drawn once in its own frame; the parent group's matrix places it, so moving or turning it costs one attribute. */
const DrawingPreview = memo(function DrawingPreview({ paths }: { paths: PreviewPaths }) {
  const common = { fill: 'none', vectorEffect: 'non-scaling-stroke' as const, pointerEvents: 'none' as const };
  return (
    <g>
      <path
        d={paths.areas}
        {...common}
        fill={KIND_COLOR.areas}
        fillOpacity={0.1}
        stroke={KIND_COLOR.areas}
        strokeWidth={1}
      />
      <path
        d={paths.machines}
        {...common}
        fill={KIND_COLOR.machines}
        fillOpacity={0.25}
        stroke={KIND_COLOR.machines}
        strokeWidth={1}
      />
      <path
        d={paths.pillars}
        {...common}
        fill={KIND_COLOR.pillars}
        fillOpacity={0.4}
        stroke={KIND_COLOR.pillars}
        strokeWidth={1}
      />
      <path d={paths.partitions} {...common} stroke={KIND_COLOR.partitions} strokeWidth={1.6} />
      <path d={paths.walls} {...common} stroke={KIND_COLOR.walls} strokeWidth={2} />
      <path d={paths.doors} {...common} stroke={KIND_COLOR.doors} strokeWidth={3} />
    </g>
  );
});

export type PickState = { on: boolean; pairs: { from: P; to: P | null }[] };
const nearest = (pts: P[], at: P, within: number): P | null => {
  let best: P | null = null,
    bd = within;
  for (const p of pts) {
    const d = Math.hypot(p[0] - at[0], p[1] - at[1]);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
};

/**
 * The map under the drawing, for placing one on the other: drag the drawing to move it, the round handle to turn it, right button or Space to move around, wheel to zoom. In "pick two points"
 * mode every click chooses a point (snapping to corners and line ends) instead.
 */
export function AlignCanvas({
  bounds,
  context,
  paths,
  centre,
  t,
  onT,
  clip,
  pick,
  onPick,
  label,
}: {
  bounds: Area;
  context: MapContext;
  paths: PreviewPaths;
  /** the drawing's centre (its frame) */
  centre: P;
  t: Similarity;
  onT(t: Similarity): void;
  clip: Area | null;
  pick: PickState;
  /** a point chosen in pick mode: on the drawing (its frame) or on the map */
  onPick(p: P, on: 'drawing' | 'map'): void;
  label: string;
}) {
  const vp = useViewport(bounds);
  const { attach: attachBox, u, panBy, toSite, viewBox } = vp;
  const attach = useCallback((n: HTMLDivElement | null) => attachBox(n), [attachBox]);
  const space = useSpacePan(panBy);
  const drag = useRef<{
    kind: 'move' | 'turn' | 'pan';
    at: P;
    px: number;
    py: number;
    sx: number;
    sy: number;
    t: Similarity;
    a0: number;
    moved: boolean;
  } | null>(null);
  const [grab, setGrab] = useState(false);
  const mapKeys = useMemo<P[]>(
    () => [
      ...context.walls.flatMap((w) => [w.a, w.b]),
      ...context.equipment.flatMap((e) => [[e.x, e.y] as P]),
      ...context.stations,
    ],
    [context],
  );
  const c = applyPoint(t, centre);
  const pointer = (e: ReactPointerEvent) => {
    const s = toSite(e.clientX, e.clientY);
    return [s.x, s.y] as P;
  };

  const down = (e: ReactPointerEvent) => {
    const at = pointer(e);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (pick.on && e.button === 0) {
      drag.current = {
        kind: 'pan',
        at,
        px: e.clientX,
        py: e.clientY,
        sx: e.clientX,
        sy: e.clientY,
        t,
        a0: 0,
        moved: false,
      }; // a drag still pans; a click picks
      return;
    }
    const base = { at, px: e.clientX, py: e.clientY, sx: e.clientX, sy: e.clientY, t, moved: false };
    if (e.button !== 0) drag.current = { ...base, kind: 'pan', a0: 0 };
    else if ((e.target as Element).getAttribute('data-handle')) {
      drag.current = { ...base, kind: 'turn', a0: Math.atan2(at[1] - c[1], at[0] - c[0]) };
    } else drag.current = { ...base, kind: 'move', a0: 0 };
    setGrab(true);
  };
  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'pan') {
      panBy(e.clientX - d.px, e.clientY - d.py);
      d.px = e.clientX;
      d.py = e.clientY;
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) d.moved = true;
      return;
    }
    const at = pointer(e);
    if (d.kind === 'move') onT({ ...d.t, dx: d.t.dx + (at[0] - d.at[0]), dy: d.t.dy + (at[1] - d.at[1]) });
    else {
      const a = Math.atan2(at[1] - c[1], at[0] - c[0]);
      onT(aboutCentre(d.t, centre, { rot: d.t.rot + (a - d.a0) }));
    }
  };
  const up = (e: ReactPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setGrab(false);
    if (!d || !pick.on || e.button !== 0 || d.moved) return; // a drag was a pan, not a pick
    const at = pointer(e);
    const wait = pick.pairs.length && pick.pairs[pick.pairs.length - 1].to === null; // the drawing point is chosen, now the map's
    const within = 14 * u;
    if (!wait) {
      const own = paths.keys.map((k) => applyPoint(t, k));
      const k = nearest(own, at, within);
      onPick(k ? invert(t, k) : invert(t, at), 'drawing');
    } else {
      onPick(nearest(mapKeys, at, within) ?? at, 'map');
    }
  };

  return (
    <div
      ref={attach}
      role="application"
      aria-label={label}
      className={`relative size-full touch-none overflow-hidden bg-[#f6f7f5] select-none ${pick.on ? 'cursor-crosshair' : grab ? 'cursor-grabbing' : 'cursor-grab'}`}
      data-no-pan
    >
      <svg
        width="100%"
        height="100%"
        viewBox={viewBox}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => (drag.current = null)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <g transform={`translate(${-bounds.minX} ${bounds.maxY}) scale(1 -1)`} pointerEvents="none">
          {context.lanes.map((l, i) => (
            <polyline
              key={i}
              points={l.map((p) => p.join(',')).join(' ')}
              fill="none"
              stroke="#14b8a6"
              strokeOpacity={0.35}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {context.walls.map((w, i) => (
            <line
              key={i}
              x1={w.a[0]}
              y1={w.a[1]}
              x2={w.b[0]}
              y2={w.b[1]}
              stroke="#52525b"
              strokeWidth={1.2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {context.equipment.map((e, i) => (
            <rect
              key={i}
              x={e.x - e.w / 2}
              y={e.y - e.d / 2}
              width={e.w}
              height={e.d}
              transform={`rotate(${((e.rot ?? 0) * 180) / Math.PI} ${e.x} ${e.y})`}
              fill="#a1a1aa"
              fillOpacity={0.35}
              stroke="#71717a"
              strokeWidth={0.8}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {context.stations.map((p, i) => (
            <circle
              key={i}
              cx={p[0]}
              cy={p[1]}
              r={4 * u}
              fill="#f59e0b"
              stroke="#fff"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {clip && (
            <rect
              x={clip.minX}
              y={clip.minY}
              width={clip.maxX - clip.minX}
              height={clip.maxY - clip.minY}
              fill="none"
              stroke="#0d9488"
              strokeDasharray="6 4"
              strokeWidth={1.2}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </g>
        <g transform={svgMatrix(t, bounds.minX, bounds.maxY)} pointerEvents="none">
          <DrawingPreview paths={paths} />
        </g>
        {!pick.on && (
          <g transform={`translate(${c[0] - bounds.minX} ${bounds.maxY - c[1]})`}>
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={-70 * u}
              stroke="#0d9488"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            <circle r={4 * u} fill="#0d9488" pointerEvents="none" />
            <circle
              data-handle="turn"
              cx={0}
              cy={-70 * u}
              r={9 * u}
              fill="#fff"
              stroke="#0d9488"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              style={{ cursor: 'grab' }}
            />
          </g>
        )}
        {pick.pairs.map((p, i) => {
          const a = applyPoint(t, p.from);
          return (
            <g key={i}>
              <MarkerDot
                at={[a[0] - bounds.minX, bounds.maxY - a[1]]}
                u={u}
                color="#2563eb"
                text={String.fromCharCode(65 + i)}
              />
              {p.to && (
                <MarkerDot
                  at={[p.to[0] - bounds.minX, bounds.maxY - p.to[1]]}
                  u={u}
                  color="#16a34a"
                  text={String.fromCharCode(65 + i)}
                />
              )}
            </g>
          );
        })}
      </svg>
      {space}
      <ZoomControls vp={vp} />
    </div>
  );
}

function MarkerDot({ at, u, color, text }: { at: P; u: number; color: string; text: string }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]}) scale(${u})`} pointerEvents="none">
      <circle r={9} fill={color} stroke="#fff" strokeWidth={2} />
      <text y={4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
        {text}
      </text>
    </g>
  );
}
