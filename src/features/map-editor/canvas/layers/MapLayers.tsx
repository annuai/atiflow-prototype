import type { ComponentProps, PointerEvent as ReactPointerEvent } from 'react';
import { isCoarse } from '@/components/map/useTouchGestures';
import { stationColor } from '../../model/stations';
import type { MapData } from '../../model/types';
import { zoneType } from '../../model/zoneTypes';
import { ImportedLayers } from './BaseLayer';
import { ZoneHandles } from './ZoneHandles';
import { centreOf, gateNormal } from '../../model/shape';
import { polyPoints, type P, type stagingGeometry } from '../layers';
import type { useViewport } from '../useViewport';

type Vp = ReturnType<typeof useViewport>;
type IsSelected = (kind: string, id: string) => boolean;
type DragStart = (e: ReactPointerEvent, kind: 'station' | 'staging', id: string, x: number, y: number) => void;
type DragEnd = (e: ReactPointerEvent) => void;

/** The map's zones: tinted, dashed (areas are plain), selectable. */
export function ZoneLayer({
  under,
  zones,
  vp,
  isSelected,
  handles,
}: {
  /** an imported map's floor picture and mapping path, drawn first so the zones lie on top of them */
  under: Pick<MapData, 'base' | 'path'>;
  zones: MapData['zones'];
  vp: Vp;
  isSelected: IsSelected;
  /** the selected zone's drag / resize / rotate handles (a draft) */
  handles?: Omit<ComponentProps<typeof ZoneHandles>, 'vp'>;
}) {
  return (
    <>
      <ImportedLayers data={under} vp={vp} />
      {zones.map((z) => (
        <GateMark key={`g-${z.id}`} zone={z} vp={vp} />
      ))}
      {zones.map((z) => {
        const t = zoneType(z.type);
        const s = isSelected('zone', z.id);
        return (
          <polygon
            key={z.id}
            data-hit={`zone:${z.id}`}
            points={polyPoints(vp, z.polygon)}
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
      {handles && <ZoneHandles {...handles} vp={vp} />}
    </>
  );
}

/** A Line gate: its line and an arrow towards the side it applies to (the side robots come from). Pixel sized. */
function GateMark({ zone, vp }: { zone: MapData['zones'][number]; vp: Vp }) {
  const s = zone.shape;
  if (s.kind !== 'gate') return null;
  const t = zoneType(zone.type);
  const n = gateNormal(s),
    [mx, my] = centreOf(s),
    len = 22 * vp.u,
    head = 6 * vp.u;
  const tip: P = [mx + n[0] * len, my + n[1] * len],
    base: P = [tip[0] - n[0] * head, tip[1] - n[1] * head],
    side: P = [-n[1] * head * 0.6, n[0] * head * 0.6];
  const X = vp.X,
    Y = vp.Y;
  return (
    <g pointerEvents="none">
      <line
        x1={X(s.a[0])}
        y1={Y(s.a[1])}
        x2={X(s.b[0])}
        y2={Y(s.b[1])}
        stroke={t.color}
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={X(mx)}
        y1={Y(my)}
        x2={X(base[0])}
        y2={Y(base[1])}
        stroke={t.color}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      <polygon
        fill={t.color}
        points={`${X(tip[0])},${Y(tip[1])} ${X(base[0] + side[0])},${Y(base[1] + side[1])} ${X(base[0] - side[0])},${Y(base[1] - side[1])}`}
      />
    </g>
  );
}

/** Staging areas: outline and cell grid; a draft's can be dragged. */
export function StagingLayer({
  staging,
  isSelected,
  movable,
  startDrag,
  endDrag,
}: {
  staging: ReturnType<typeof stagingGeometry>;
  isSelected: IsSelected;
  /** the pointer shows "move" (a draft, no drawing tool) */
  movable: boolean;
  startDrag: DragStart;
  endDrag: DragEnd;
}) {
  return (
    <>
      {staging.map(({ a, u, cells, stations, letters, numbers, arrow, outline: o }) => (
        <g
          key={a.id}
          data-hit={`staging:${a.id}`}
          style={{ cursor: movable ? 'move' : 'pointer' }}
          onPointerDown={(e) => startDrag(e, 'staging', a.id, a.x, a.y)}
          onPointerUp={endDrag}
        >
          <polygon
            points={o}
            fill="#e0f2fe"
            fillOpacity={isSelected('staging', a.id) ? 0.95 : 0.7}
            stroke={isSelected('staging', a.id) ? '#0284c7' : '#7dd3fc'}
            strokeWidth={isSelected('staging', a.id) ? 2.2 : 1.4}
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
          <path
            d={stations}
            fill="none"
            stroke="#0284c7"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
          {isSelected('staging', a.id) && (
            <g
              pointerEvents="none"
              fontSize={20 * u}
              fontWeight={600}
              fill="#0369a1"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {letters.map((l) => (
                <text key={'c' + l.text} x={l.x} y={l.y}>
                  {l.text}
                </text>
              ))}
              {numbers.map((l) => (
                <text key={'r' + l.text} x={l.x} y={l.y}>
                  {l.text}
                </text>
              ))}
              <DirectionArrow tail={arrow.tail} tip={arrow.tip} u={u} />
            </g>
          )}
          <title>{`${a.name} · ${a.rows} x ${a.cols}`}</title>
        </g>
      ))}
    </>
  );
}

/** A wide invisible line over each road, so a road is easy to click (it shows when selected). */
export function RoadHits({ roads, isSelected }: { roads: { id: string; pts: string }[]; isSelected: IsSelected }) {
  return (
    <>
      {roads.map((r) => (
        <polyline
          key={r.id}
          data-hit={`road:${r.id}`}
          points={r.pts}
          fill="none"
          stroke={isSelected('road', r.id) ? '#0f766e' : 'transparent'}
          strokeWidth={isSelected('road', r.id) ? 4 : isCoarse ? 26 : 12}
          strokeOpacity={isSelected('road', r.id) ? 0.55 : 1}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: 'stroke' }}
        />
      ))}
    </>
  );
}

/** The shape being drawn, the points placed so far and the ring under the cursor. */
export function DrawingLayer({
  preview,
  drawing,
  cursor,
  active,
  vp,
}: {
  preview: { kind: 'line' | 'polygon'; pts: P[]; color: string } | null;
  drawing: P[];
  cursor: P | null;
  /** a drawing tool is armed and the map is editable */
  active: boolean;
  vp: Vp;
}) {
  return (
    <>
      {preview &&
        (preview.kind === 'line' ? (
          <polyline
            points={polyPoints(vp, preview.pts)}
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
            points={polyPoints(vp, preview.pts)}
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
      {active && cursor && (
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
    </>
  );
}

/** Stations: a dot in the type's colour that keeps its pixel size; the name shows when selected, hovered or zoomed in. */
export function StationLayer({
  stations,
  nodes,
  vp,
  isSelected,
  hover,
  onHover,
  showLabels,
  movable,
  startDrag,
  endDrag,
}: {
  stations: MapData['stations'];
  nodes: Map<string, { x: number; y: number }>;
  vp: Vp;
  isSelected: IsSelected;
  hover: string | null;
  onHover(id: string | null): void;
  showLabels: boolean;
  movable: boolean;
  startDrag: DragStart;
  endDrag: DragEnd;
}) {
  return (
    <>
      {stations.map((s) => {
        const n = nodes.get(s.nodeId);
        if (!n) return null;
        const sl = isSelected('station', s.id);
        const col = stationColor(s.type);
        return (
          <g
            key={s.id}
            transform={`translate(${vp.X(n.x)} ${vp.Y(n.y)}) scale(${vp.u})`}
            data-hit={`station:${s.id}`}
            style={{ cursor: movable ? 'move' : 'pointer' }}
            onPointerEnter={() => onHover(s.id)}
            onPointerLeave={() => onHover(null)}
            onPointerDown={(e) => startDrag(e, 'station', s.id, n.x, n.y)}
            onPointerUp={endDrag}
          >
            <title>{`${s.name} · ${s.id}`}</title>
            <circle r={isCoarse ? 22 : 14} fill="transparent" data-hit={`station:${s.id}`} />
            {sl && <circle r={13} fill="#5eead4" fillOpacity={0.35} />}
            {sl && <circle r={10} fill="none" stroke="#0d9488" strokeWidth={1.8} />}
            {s.angle !== undefined && (
              // the way the robot faces at the station (degrees counter-clockwise from east; the screen's y points down)
              <path
                transform={`rotate(${-s.angle})`}
                d="M5 0H19M14.5 -4L19 0L14.5 4"
                fill="none"
                stroke="#2563eb"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
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
    </>
  );
}

/** A ring that pulses a few times where "Locate on Map" pointed. */
export function LocatePulse({
  locate,
  vp,
}: {
  locate: { x: number; y: number; span: number; n: number } | null | undefined;
  vp: Vp;
}) {
  if (!locate) return null;
  return (
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
  );
}

/** One arrow on the area: the way every cell faces (the cell angle). */
export function DirectionArrow({ tail, tip, u }: { tail: P; tip: P; u: number }) {
  const a = Math.atan2(tip[1] - tail[1], tip[0] - tail[0]),
    h = 18 * u;
  const wing = (d: number): string => `${tip[0] - h * Math.cos(a + d)},${tip[1] - h * Math.sin(a + d)}`;
  return (
    <path
      d={`M${tail[0]},${tail[1]}L${tip[0]},${tip[1]}M${wing(0.5)}L${tip[0]},${tip[1]}L${wing(-0.5)}`}
      stroke="#f97316"
      strokeWidth={2.5 * u}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
