import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Home01, Minus, Plus } from '@untitledui/icons';
import { laneArrowPath } from '@/components/map/laneArrows';
import { gestureBusy, isCoarse, useTouchGestures } from '@/components/map/useTouchGestures';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import type { SiteLayout } from '@/core/types';
import { nearestNode } from '../model/roads';
import { cellCenter, outline } from '../model/staging';
import { stationColor } from '../model/stations';
import type { MapData, Selection } from '../model/types';
import { boxPolygon, gatePolygon } from '../model/zones';
import { zoneType } from '../model/zoneTypes';
import { drawMode, type Tool } from './tools';
import { useViewport } from './useViewport';

type P = [number, number];
interface Props {
  site: SiteLayout;
  data: MapData;
  tool: Tool;
  editable: boolean;
  selection: Selection;
  /** Which things the module can select (a click on anything else selects nothing). */ canSelect(
    sel: NonNullable<Selection>,
  ): boolean;
  onSelect(sel: Selection): void;
  /** The points of the shape being drawn so far, and a click while a drawing tool is active. */ drawing: P[];
  onPoint(p: P): void;
  onFinish(): void;
  /** Centre the view on a place and pulse it (a new `n` each time, so the same place can be shown again). */ locate?: {
    x: number;
    y: number;
    span: number;
    n: number;
  } | null;
  /** Drawn on top of the map inside its SVG (the simulation). */ overlay?: (
    vp: ReturnType<typeof useViewport>,
  ) => ReactNode;
  /** A station or staging area is dragged (called while dragging, with the new position). */ onMove(
    kind: 'station' | 'staging',
    id: string,
    to: { x: number; y: number },
  ): void;
}

/**
 * The map in the editor: the real floor, the map's own roads, zones, staging areas and stations, with the tools of the open module. Drag the floor to pan, wheel to zoom. Markers and labels keep
 * their pixel size when zooming. A click does what the tool says (select, place, add a point); a double-click finishes a road or zone; stations and staging areas of a draft can be dragged.
 */
export function MapCanvas({
  site,
  data,
  tool,
  editable,
  selection,
  canSelect,
  onSelect,
  drawing,
  onPoint,
  onFinish,
  onMove,
  overlay,
  locate,
}: Props) {
  const vp = useViewport(site.bounds);
  const { P } = vp;
  const [hover, setHover] = useState<string | null>(null);
  const [cursor, setCursor] = useState<P | null>(null);
  const layers = useMemo(
    () => ({
      walls: site.walls.map((w) => `M${P(w.a[0], w.a[1])}L${P(w.b[0], w.b[1])}`).join(''),
      machines: site.equipment
        .map((e) => {
          const x = e.x - e.w / 2,
            y = e.y - e.d / 2;
          return `M${P(x, y)}L${P(x + e.w, y)}L${P(x + e.w, y + e.d)}L${P(x, y + e.d)}Z`;
        })
        .join(''),
      floor: site.floorPolygons.map((p) => 'M' + p.map(([x, y]) => P(x, y)).join('L') + 'Z').join(''),
      grid: (() => {
        const { minX, maxX, minY, maxY } = site.bounds;
        const g: string[] = [];
        for (let x = Math.ceil(minX / 10) * 10; x <= maxX; x += 10) g.push(`M${P(x, minY)}L${P(x, maxY)}`);
        for (let y = Math.ceil(minY / 10) * 10; y <= maxY; y += 10) g.push(`M${P(minX, y)}L${P(maxX, y)}`);
        return g.join('');
      })(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [site],
  );
  const lanes = useMemo(
    () => data.lanes.map((l) => 'M' + l.geom.map(([x, y]) => P(x, y)).join('L')).join(''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.lanes],
  );
  useEffect(() => {
    if (locate) vp.focusOn(locate.x, locate.y, locate.span);
  }, [locate?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  const arrows = useMemo(
    () => laneArrowPath(data.lanes, (x, y) => [vp.X(x), vp.Y(y)], vp.u),
    [data.lanes, vp.u, vp.X, vp.Y],
  );
  const roadLines = useMemo(
    () =>
      data.roads.map((r) => ({
        id: r.id,
        pts: r.points.map(([x, y]) => `${vp.X(x).toFixed(2)},${vp.Y(y).toFixed(2)}`).join(' '),
      })),
    [data.roads, vp.X, vp.Y],
  );
  const nodes = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes]);
  const staging = useMemo(
    () =>
      data.stagingAreas.map((a) => {
        const cells: string[] = [];
        const hl = a.cellLength / 2,
          hw = a.cellWidth / 2,
          t = (a.rotation * Math.PI) / 180,
          dx = Math.cos(t),
          dy = Math.sin(t),
          rx = Math.sin(t),
          ry = -Math.cos(t);
        for (let r = 1; r <= a.rows; r++)
          for (let c = 1; c <= a.cols; c++) {
            const m = cellCenter(a, r, c);
            const k = (sx: number, sy: number) =>
              P(m.x + sx * hl * dx + sy * hw * rx, m.y + sx * hl * dy + sy * hw * ry);
            cells.push(`M${k(-1, -1)}L${k(1, -1)}L${k(1, 1)}L${k(-1, 1)}Z`);
          }
        return {
          a,
          cells: cells.join(''),
          outline: outline(a)
            .map(([x, y]) => `${vp.X(x).toFixed(2)},${vp.Y(y).toFixed(2)}`)
            .join(' '),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.stagingAreas, vp.X, vp.Y],
  );

  const mode = drawMode(tool);
  const snap = (p: P): P => {
    if (tool.kind !== 'road') return p;
    const n = nearestNode(data.nodes, p[0], p[1], 12 * vp.u);
    return n ? [n.x, n.y] : p;
  };
  const touch = useTouchGestures(vp.box, { zoomAt: vp.zoomAt, panBy: vp.panBy });
  const pan = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const dragging = useRef<{ kind: 'station' | 'staging'; id: string; dx: number; dy: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    pan.current = { x: e.clientX, y: e.clientY, moved: false };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onMove_ = (e: React.PointerEvent) => {
    if (touch.current.pinching) {
      if (pan.current) {
        pan.current.x = e.clientX;
        pan.current.y = e.clientY;
        pan.current.moved = true;
      }
      return;
    } // two fingers: the pinch handles it
    const at = vp.toSite(e.clientX, e.clientY);
    setCursor(snap([at.x, at.y]));
    if (dragging.current) {
      const d = dragging.current;
      onMove(d.kind, d.id, { x: at.x + d.dx, y: at.y + d.dy });
      return;
    }
    const p = pan.current;
    if (!p) return;
    const dx = e.clientX - p.x,
      dy = e.clientY - p.y;
    if (!p.moved && Math.hypot(dx, dy) < 4) return;
    p.moved = true;
    p.x = e.clientX;
    p.y = e.clientY;
    vp.panBy(dx, dy);
  };
  const hit = (x: number, y: number): Selection => {
    for (const el of document.elementsFromPoint(x, y)) {
      const h = (el as Element).getAttribute?.('data-hit');
      if (h) {
        const [kind, ...id] = h.split(':');
        const sel = { kind, id: id.join(':') } as NonNullable<Selection>;
        if (canSelect(sel)) return sel;
      }
    }
    return null;
  };
  const onUp = (e: React.PointerEvent) => {
    if (gestureBusy(touch.current)) {
      pan.current = null;
      dragging.current = null;
      return;
    } // a finger lifting after a pinch is not a tap
    const p = pan.current;
    pan.current = null;
    const was = dragging.current;
    dragging.current = null;
    if (was) return;
    if (!p || p.moved) return;
    if (mode !== 'none') {
      if (editable) {
        const at = vp.toSite(e.clientX, e.clientY);
        onPoint(snap([at.x, at.y]));
      }
      return;
    }
    onSelect(hit(e.clientX, e.clientY));
  };
  const startDrag = (e: React.PointerEvent, kind: 'station' | 'staging', id: string, x: number, y: number) => {
    e.stopPropagation();
    onSelect({ kind, id });
    if (!editable || mode !== 'none') return;
    const at = vp.toSite(e.clientX, e.clientY);
    dragging.current = { kind, id, dx: x - at.x, dy: y - at.y };
    (e.currentTarget as SVGGElement).ownerSVGElement?.setPointerCapture(e.pointerId);
  };
  const sel = (kind: string, id: string) => selection?.kind === kind && selection.id === id;
  const showLabels = vp.zoom >= 2.4;
  const poly = (pts: P[]) => pts.map(([x, y]) => `${vp.X(x).toFixed(2)},${vp.Y(y).toFixed(2)}`).join(' ');
  // the shape being drawn: what the points so far and the cursor make
  const preview: { kind: 'line' | 'polygon'; pts: P[]; color: string } | null = (() => {
    if (mode === 'none' || mode === 'one' || !drawing.length) return null;
    const live = cursor ? [...drawing, cursor] : drawing;
    if (tool.kind === 'road') return { kind: 'line', pts: live, color: '#0d9488' };
    if (tool.kind === 'gate')
      return cursor
        ? {
            kind: 'polygon',
            pts: tool.shape === 'box' ? boxPolygon(drawing[0], cursor) : gatePolygon(drawing[0], cursor),
            color: zoneType('exclusive').color,
          }
        : null;
    if (tool.kind === 'zone') return { kind: 'polygon', pts: live, color: zoneType(tool.type).color };
    return null;
  })();
  const cursorClass = mode !== 'none' && editable ? 'cursor-crosshair' : 'cursor-grab';
  return (
    <div
      ref={vp.box}
      className="relative size-full touch-none select-none overflow-hidden bg-[#f6f7f5]"
      data-no-pan
      onWheel={(e) => vp.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY)}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={vp.viewBox}
        role="img"
        aria-label="Map"
        className={cursorClass}
        onPointerDown={onDown}
        onPointerMove={onMove_}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => setCursor(null)}
        onDoubleClick={() => {
          if (mode === 'many' && editable) onFinish();
        }}
      >
        <path d={layers.grid} fill="none" stroke="#e5e7eb" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <path d={layers.floor} fill="#ffffff" stroke="#d4d4d8" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {data.zones.map((z) => {
          const t = zoneType(z.type);
          const s = sel('zone', z.id);
          return (
            <polygon
              key={z.id}
              data-hit={`zone:${z.id}`}
              points={poly(z.polygon)}
              fill={t.color}
              fillOpacity={z.type === 'area' ? 0.07 : s ? 0.28 : 0.16}
              stroke={t.color}
              strokeOpacity={s ? 1 : 0.6}
              strokeWidth={s ? 2.2 : 1.2}
              strokeDasharray={z.type === 'area' ? undefined : '5 4'}
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${z.name} · ${t.label}`}</title>
            </polygon>
          );
        })}
        <path d={layers.machines} fill="#d8dcd8" fillOpacity={0.75} pointerEvents="none" />
        {staging.map(({ a, cells, outline: o }) => (
          <g
            key={a.id}
            data-hit={`staging:${a.id}`}
            style={{ cursor: editable && mode === 'none' ? 'move' : 'pointer' }}
            onPointerDown={(e) => startDrag(e, 'staging', a.id, a.x, a.y)}
            onPointerUp={(e) => {
              e.stopPropagation();
              dragging.current = null;
            }}
          >
            <polygon
              points={o}
              fill="#e0f2fe"
              fillOpacity={sel('staging', a.id) ? 0.95 : 0.7}
              stroke={sel('staging', a.id) ? '#0284c7' : '#7dd3fc'}
              strokeWidth={sel('staging', a.id) ? 2.2 : 1.4}
              vectorEffect="non-scaling-stroke"
              data-hit={`staging:${a.id}`}
            />
            <path
              d={cells}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={0.8}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            <title>{`${a.name} · ${a.rows} x ${a.cols}`}</title>
          </g>
        ))}
        <path
          d={lanes}
          fill="none"
          stroke="#14b8a6"
          strokeOpacity={0.5}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
        <path d={arrows} fill="#0f766e" fillOpacity={0.85} pointerEvents="none" />
        {roadLines.map((r) => (
          <polyline
            key={r.id}
            data-hit={`road:${r.id}`}
            points={r.pts}
            fill="none"
            stroke={sel('road', r.id) ? '#0f766e' : 'transparent'}
            strokeWidth={sel('road', r.id) ? 4 : isCoarse ? 26 : 12}
            strokeOpacity={sel('road', r.id) ? 0.55 : 1}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: 'stroke' }}
          />
        ))}
        <path
          d={layers.walls}
          fill="none"
          stroke="#52525b"
          strokeWidth={1.2}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
        {preview &&
          (preview.kind === 'line' ? (
            <polyline
              points={poly(preview.pts)}
              fill="none"
              stroke={preview.color}
              strokeWidth={2.5}
              strokeDasharray="6 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          ) : (
            <polygon
              points={poly(preview.pts)}
              fill={preview.color}
              fillOpacity={0.2}
              stroke={preview.color}
              strokeWidth={2}
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          ))}
        {drawing.map((p, i) => (
          <circle
            key={i}
            cx={vp.X(p[0])}
            cy={vp.Y(p[1])}
            r={4 * vp.u}
            fill="#fff"
            stroke="#0d9488"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        ))}
        {mode !== 'none' && editable && cursor && (
          <circle
            cx={vp.X(cursor[0])}
            cy={vp.Y(cursor[1])}
            r={6 * vp.u}
            fill="none"
            stroke="#0d9488"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )}
        {data.stations.map((s) => {
          const n = nodes.get(s.nodeId);
          if (!n) return null;
          const sl = sel('station', s.id);
          const col = stationColor(s.type);
          return (
            <g
              key={s.id}
              transform={`translate(${vp.X(n.x)} ${vp.Y(n.y)}) scale(${vp.u})`}
              data-hit={`station:${s.id}`}
              style={{ cursor: editable && mode === 'none' ? 'move' : 'pointer' }}
              onPointerEnter={() => setHover(s.id)}
              onPointerLeave={() => setHover(null)}
              onPointerDown={(e) => startDrag(e, 'station', s.id, n.x, n.y)}
              onPointerUp={(e) => {
                e.stopPropagation();
                dragging.current = null;
              }}
            >
              <title>{`${s.name} · ${s.id}`}</title>
              <circle r={isCoarse ? 22 : 14} fill="transparent" data-hit={`station:${s.id}`} />
              {sl && <circle r={13} fill="#5eead4" fillOpacity={0.35} />}
              {sl && <circle r={10} fill="none" stroke="#0d9488" strokeWidth={1.8} />}
              <circle r={6} fill={col} stroke="#fff" strokeWidth={1.8} />
              {(sl || hover === s.id || showLabels) && (
                <text
                  x={11}
                  y={4}
                  fontSize={11}
                  fontWeight={600}
                  fill="#1f2937"
                  paintOrder="stroke"
                  stroke="#fff"
                  strokeWidth={3}
                  strokeLinejoin="round"
                >
                  {s.name}
                </text>
              )}
            </g>
          );
        })}
        {locate && (
          <circle
            key={locate.n}
            cx={vp.X(locate.x)}
            cy={vp.Y(locate.y)}
            r={14 * vp.u}
            fill="none"
            stroke="#0d9488"
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          >
            <animate
              attributeName="r"
              from={10 * vp.u}
              to={Math.max(40 * vp.u, locate.span * 0.7)}
              dur="0.9s"
              repeatCount="3"
            />
            <animate attributeName="opacity" from="1" to="0" dur="0.9s" repeatCount="3" />
          </circle>
        )}
        {overlay?.(vp)}
      </svg>
      {cursor && (
        <span
          className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-primary/90 px-2 py-1 text-xs tabular-nums text-secondary shadow-xs ring-1 ring-secondary"
          aria-live="off"
        >
          X: {cursor[0].toFixed(2)} &nbsp; Y: {cursor[1].toFixed(2)}
        </span>
      )}
      <div
        className="map-zoom absolute right-3 bottom-3 flex flex-col gap-1 rounded-lg bg-primary p-1 shadow-sm ring-1 ring-secondary"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <ButtonUtility
          size="sm"
          color="tertiary"
          icon={Plus}
          tooltip="Zoom in"
          aria-label="Zoom in"
          onPress={() => vp.zoomAt(1.5)}
        />
        <ButtonUtility
          size="sm"
          color="tertiary"
          icon={Minus}
          tooltip="Zoom out"
          aria-label="Zoom out"
          onPress={() => vp.zoomAt(1 / 1.5)}
        />
        <ButtonUtility
          size="sm"
          color="tertiary"
          icon={Home01}
          tooltip="Fit the whole map"
          aria-label="Fit the whole map"
          onPress={vp.reset}
        />
      </div>
    </div>
  );
}
