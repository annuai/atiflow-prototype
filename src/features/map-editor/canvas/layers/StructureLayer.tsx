import type { PointerEvent as ReactPointerEvent } from 'react';
import { isCoarse } from '@/components/map/useTouchGestures';
import { elementColor, shownText } from '../../model/structure/derive';
import { modelOf } from '../../model/structure/ops';
import type {
  AreaElement,
  BoxElement,
  DoorElement,
  LineElement,
  P,
  StructureElement,
} from '../../model/structure/types';
import type { MapData, MapZone, ZoneShape } from '../../model/types';
import type { useViewport } from '../useViewport';
import { polyPoints } from '../layers';
import { boxAround, carry } from '../../model/structure/transform';
import { ZoneHandles } from './ZoneHandles';

type Vp = ReturnType<typeof useViewport>;

export interface StructureLayerProps {
  data: MapData;
  vp: Vp;
  /** the Structure module is open: elements can be picked, the estimate shows as a faint underlay */
  active: boolean;
  /** the faint scan under the elements (shown while the Structure module is open) */
  underlay?: boolean;
  /** the select tool is on (not a drawing tool): elements can be dragged */
  selecting: boolean;
  editable: boolean;
  /** the one selected element (it shows its handles) */
  selectedId: string | null;
  /** every selected element (several when Select multiple is on or Shift is held) */
  selectedIds?: string[];
  /** Select multiple is on: a click toggles an element in the selection and never drags it */
  multi?: boolean;
  onSelect(id: string, additive?: boolean): void;
  onMove(id: string, dx: number, dy: number): void;
  onPoint(id: string, index: number, to: P): void;
  onBox(id: string, b: { x: number; y: number; w: number; d: number; rot: number }): void;
  /** a wall, partition or outline is resized or turned as a whole with its eight handles and the rotate handle */
  onPoints(id: string, points: P[]): void;
}

/** A black box with white text, the way zones are labelled (kept at a constant pixel size). */
function Label({ text, at, vp, dy = 0 }: { text: string; at: P; vp: Vp; dy?: number }) {
  const w = Math.max(28, text.length * 6.6 + 14);
  return (
    <g transform={`translate(${vp.X(at[0])} ${vp.Y(at[1])}) scale(${vp.u})`} pointerEvents="none">
      <rect x={-w / 2} y={-9 + dy} width={w} height={18} rx={4} fill="#0f1b24" fillOpacity={0.88} />
      <text x={0} y={4 + dy} textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff">
        {text}
      </text>
    </g>
  );
}

/** Eight handles and a rotate handle round a wall, partition or outline (the same ones machines and zones have). */
function PointsBox({
  element,
  vp,
  onPoints,
}: {
  element: LineElement | AreaElement;
  vp: Vp;
  onPoints(id: string, points: P[]): void;
}) {
  const from = boxAround(element.points); // (what this render's drag starts from)
  const zone: MapZone = {
    id: element.id,
    type: 'area',
    name: element.name ?? element.id,
    shape: { kind: 'rect', cx: from.cx, cy: from.cy, w: from.w, h: from.h, rot: 0 },
    polygon: [],
    props: {},
  };
  return (
    <ZoneHandles
      zone={zone}
      vp={vp}
      editable
      bodyDrag={false}
      onShape={(_, shape: ZoneShape) => {
        if (shape.kind === 'rect') onPoints(element.id, carry(element.points, from, shape));
      }}
    />
  );
}
const isWork = (e: StructureElement) => e.kind === 'area' && !!e.work;
const asZone = (e: BoxElement): MapZone => ({
  id: e.id,
  type: 'area',
  name: e.name ?? e.id,
  shape: { kind: 'rect', cx: e.x, cy: e.y, w: e.w, h: e.d, rot: e.rot },
  polygon: [],
  props: {},
});

/**
 * The 3D structure drawn flat: the elements in their colours (walls and partitions as thick lines, machines and pillars as blocks with their text, areas, doors), the faint lidar estimate under
 * them while the Structure module is open, and the handles of the selected element (corners of a line or an outline; the move / resize / rotate handles of a block, the same ones zones have).
 */
export function StructureLayer({
  data,
  vp,
  active,
  underlay,
  selecting,
  editable,
  selectedId,
  selectedIds = [],
  multi,
  onSelect,
  onMove,
  onPoint,
  onBox,
  onPoints,
}: StructureLayerProps) {
  const m = modelOf(data);
  const k = Math.abs(vp.X(1) - vp.X(0)); // svg units per metre
  const hw = new Set(m.hiddenWalls),
    he = new Set(m.hiddenEquipment);
  const pick = (e: StructureElement) => (active ? { 'data-hit': `element:${e.id}` } : {});
  const dragBody = (e: ReactPointerEvent, id: string) => {
    if (!active || !selecting) return;
    e.stopPropagation();
    const additive = !!multi || e.shiftKey;
    onSelect(id, additive);
    if (!editable || additive) return;
    e.preventDefault();
    let last = vp.toSite(e.clientX, e.clientY);
    const move = (ev: PointerEvent) => {
      const at = vp.toSite(ev.clientX, ev.clientY);
      onMove(id, at.x - last.x, at.y - last.y);
      last = at;
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };
  const vertex = (e: ReactPointerEvent, id: string, i: number) => {
    e.stopPropagation();
    if (!editable) return;
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const at = vp.toSite(ev.clientX, ev.clientY);
      onPoint(id, i, [at.x, at.y]);
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };
  const selected = m.elements.find((e) => e.id === selectedId && active);
  const lineEl = (e: LineElement, color: string, sel: boolean) => {
    const pts = polyPoints(vp, e.points);
    const width = Math.max(e.thickness * k, 3 * vp.u * (e.kind === 'wall' ? 1.4 : 1));
    return (
      <g key={e.id}>
        <polyline
          points={pts}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeOpacity={e.kind === 'partition' ? 0.8 : 1}
          strokeLinecap="butt"
          strokeLinejoin="miter"
          pointerEvents="none"
        />
        {sel && (
          <polyline
            points={pts}
            fill="none"
            stroke="#0d9488"
            strokeWidth={width + 4 * vp.u}
            strokeOpacity={0.35}
            pointerEvents="none"
          />
        )}
        <polyline
          {...pick(e)}
          points={pts}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(width, (isCoarse ? 26 : 12) * vp.u)}
          strokeLinecap="round"
          style={{
            pointerEvents: active ? 'stroke' : 'none',
            cursor: active && selecting && editable ? 'move' : 'pointer',
          }}
          onPointerDown={(ev) => dragBody(ev, e.id)}
        />
      </g>
    );
  };
  const areaEl = (e: AreaElement, color: string, sel: boolean) => {
    const pts = polyPoints(vp, e.points);
    return (
      <g key={e.id}>
        <polygon
          points={pts}
          fill={color}
          fillOpacity={e.height > 0 ? 0.55 : 0.35}
          stroke={sel ? '#0d9488' : color}
          strokeWidth={sel ? 2.5 : 1.5}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
        <polygon
          {...pick(e)}
          points={pts}
          fill="transparent"
          {...(e.work
            ? { stroke: 'transparent', strokeWidth: isCoarse ? 26 : 14, vectorEffect: 'non-scaling-stroke' }
            : {})}
          style={{
            // a Work area is a big floor patch under everything: it is picked by its outline (or from the list), so the floor inside it still pans and everything on it can be picked
            pointerEvents: active ? (e.work ? 'stroke' : 'all') : 'none',
            cursor: active && selecting && editable ? 'move' : 'pointer',
          }}
          onPointerDown={(ev) => dragBody(ev, e.id)}
        />
        {e.label && <Label text={e.label} at={centroid(e.points)} vp={vp} />}
      </g>
    );
  };
  const doorEl = (e: DoorElement, sel: boolean) => {
    const c = Math.cos(e.rot),
      s = Math.sin(e.rot);
    const hwid = e.w / 2;
    const q: P[] = [
      [e.x - c * hwid, e.y - s * hwid],
      [e.x + c * hwid, e.y + s * hwid],
    ];
    return (
      <g key={e.id}>
        <line
          x1={vp.X(q[0][0])}
          y1={vp.Y(q[0][1])}
          x2={vp.X(q[1][0])}
          y2={vp.Y(q[1][1])}
          stroke="#f59e0b"
          strokeWidth={Math.max(0.25 * k, 5 * vp.u)}
          strokeLinecap="butt"
          pointerEvents="none"
        />
        {sel && (
          <line
            x1={vp.X(q[0][0])}
            y1={vp.Y(q[0][1])}
            x2={vp.X(q[1][0])}
            y2={vp.Y(q[1][1])}
            stroke="#0d9488"
            strokeWidth={Math.max(0.25 * k, 5 * vp.u) + 4 * vp.u}
            strokeOpacity={0.35}
            pointerEvents="none"
          />
        )}
        <line
          {...pick(e)}
          x1={vp.X(q[0][0])}
          y1={vp.Y(q[0][1])}
          x2={vp.X(q[1][0])}
          y2={vp.Y(q[1][1])}
          stroke="transparent"
          strokeWidth={(isCoarse ? 26 : 14) * vp.u}
          style={{ pointerEvents: active ? 'stroke' : 'none', cursor: 'pointer' }}
          onPointerDown={(ev) => dragBody(ev, e.id)}
        />
      </g>
    );
  };
  const boxEl = (b: BoxElement, color: string, sel: boolean) => {
    const e = b;
    const c = Math.cos(b.rot),
      s = Math.sin(b.rot);
    const corner = (lx: number, ly: number): P => [b.x + lx * c - ly * s, b.y + lx * s + ly * c];
    const poly = [
      corner(-b.w / 2, -b.d / 2),
      corner(b.w / 2, -b.d / 2),
      corner(b.w / 2, b.d / 2),
      corner(-b.w / 2, b.d / 2),
    ];
    const pts = polyPoints(vp, poly);
    return (
      <g key={e.id}>
        <polygon
          points={pts}
          fill={color}
          fillOpacity={0.9}
          stroke={sel ? '#0d9488' : '#475569'}
          strokeWidth={sel ? 2.5 : 1}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
        {shownText(e) && <Label text={shownText(e)!} at={[b.x, b.y]} vp={vp} />}
        {!(sel && editable && selecting) && (
          <polygon
            {...pick(e)}
            points={pts}
            fill="transparent"
            style={{
              pointerEvents: active ? 'all' : 'none',
              cursor: active && selecting && editable ? 'move' : 'pointer',
            }}
            onPointerDown={(ev) => dragBody(ev, e.id)}
          />
        )}
      </g>
    );
  };
  return (
    <g data-testid="structure-layer">
      {underlay && (
        <g pointerEvents="none" opacity={0.55}>
          {(data.structure?.walls ?? []).map(
            (w, i) =>
              !hw.has(i) && (
                <line
                  key={`w${i}`}
                  x1={vp.X(w.a[0])}
                  y1={vp.Y(w.a[1])}
                  x2={vp.X(w.b[0])}
                  y2={vp.Y(w.b[1])}
                  stroke="#64748b"
                  strokeWidth={1.4}
                  strokeDasharray="4 3"
                  vectorEffect="non-scaling-stroke"
                />
              ),
          )}
          {(data.structure?.equipment ?? []).map(
            (q, i) =>
              !he.has(i) && (
                <rect
                  key={`q${i}`}
                  x={vp.X(q.x - q.w / 2)}
                  y={vp.Y(q.y + q.d / 2)}
                  width={q.w * k}
                  height={q.d * k}
                  fill="none"
                  stroke="#64748b"
                  strokeWidth={1.2}
                  strokeDasharray="4 3"
                  vectorEffect="non-scaling-stroke"
                />
              ),
          )}
        </g>
      )}
      {[...m.elements]
        .sort((a, b) => Number(isWork(b)) - Number(isWork(a))) // Work areas lie under everything
        .map((e) => {
          const color = elementColor(data, e);
          const sel = e.id === selectedId || selectedIds.includes(e.id);
          if (e.kind === 'wall' || e.kind === 'partition') return lineEl(e, color, sel);
          if (e.kind === 'area') return areaEl(e, color, sel);
          if (e.kind === 'door') return doorEl(e, sel);
          return boxEl(e as BoxElement, color, sel);
        })}
      {selected && editable && selecting && (selected.kind === 'machine' || selected.kind === 'pillar') && (
        <ZoneHandles
          zone={asZone(selected)}
          vp={vp}
          editable
          bodyDrag
          onShape={(_, shape: ZoneShape) => {
            if (shape.kind === 'rect')
              onBox(selected.id, { x: shape.cx, y: shape.cy, w: shape.w, d: shape.h, rot: shape.rot });
          }}
        />
      )}
      {selected && editable && selecting && 'points' in selected && (
        <PointsBox element={selected} vp={vp} onPoints={onPoints} />
      )}
      {selected &&
        editable &&
        selecting &&
        'points' in selected &&
        selected.points.map((p, i) => (
          <g
            key={i}
            transform={`translate(${vp.X(p[0])} ${vp.Y(p[1])}) scale(${vp.u})`}
            style={{ cursor: 'move' }}
            onPointerDown={(ev) => vertex(ev, selected.id, i)}
            data-testid="element-vertex"
          >
            <circle r={isCoarse ? 18 : 11} fill="transparent" />
            <circle r={5.5} fill="#fff" stroke="#0d9488" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
    </g>
  );
}

const centroid = (pts: P[]): P => [
  pts.reduce((a, p) => a + p[0], 0) / pts.length,
  pts.reduce((a, p) => a + p[1], 0) / pts.length,
];
