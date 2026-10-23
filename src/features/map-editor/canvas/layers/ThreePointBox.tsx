import { isCoarse } from '@/components/map/useTouchGestures';
import type { ThreePointTurn } from '../../model/approach/types';
import type { MapData } from '../../model/types';
import type { useViewport } from '../useViewport';

type Vp = ReturnType<typeof useViewport>;
const COLOR = '#d97706';
/** The least a side of the box can be dragged to (m). */
const MIN = 0.5;
const snap = (v: number) => Math.max(MIN, Math.round(v * 20) / 20);

/**
 * The box a three-point turn must finish in, drawn in front of the station (the station faces the lane): `aisleLength` along the way it faces and `aisleWidth` across. Two handles: the far
 * end sets the length, the side sets the width. Only the selected station shows it, and only when it asks for a three-point turn.
 */
export function ThreePointBox({
  data,
  stationId,
  vp,
  editable,
  onChange,
}: {
  data: MapData;
  stationId: string | null;
  vp: Vp;
  editable: boolean;
  onChange(stationId: string, patch: Partial<ThreePointTurn>): void;
}) {
  const s = stationId ? data.stations.find((q) => q.id === stationId) : undefined;
  const turn = s?.features?.threePointTurn;
  const at = s && data.nodes.find((n) => n.id === s.nodeId);
  if (!s || !turn || !at) return null;
  const a = ((s.angle ?? 0) * Math.PI) / 180;
  const u = [Math.cos(a), Math.sin(a)] as const; // the way the station faces (towards the lane)
  const v = [-Math.sin(a), Math.cos(a)] as const; // across it, to the left
  const { aisleLength: L, aisleWidth: W } = turn;
  const pt = (along: number, across: number): [number, number] => [
    at.x + u[0] * along + v[0] * across,
    at.y + u[1] * along + v[1] * across,
  ];
  const corners = [pt(0, -W / 2), pt(L, -W / 2), pt(L, W / 2), pt(0, W / 2)];
  const px = (p: [number, number]) => `${vp.X(p[0])},${vp.Y(p[1])}`;
  const drag = (kind: 'length' | 'width') => (e: React.PointerEvent) => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const p = vp.toSite(ev.clientX, ev.clientY);
      const dx = p.x - at.x,
        dy = p.y - at.y;
      if (kind === 'length') onChange(s.id, { aisleLength: snap(dx * u[0] + dy * u[1]) });
      else onChange(s.id, { aisleWidth: snap(2 * Math.abs(dx * v[0] + dy * v[1])) });
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
  const handle = (p: [number, number], kind: 'length' | 'width') => (
    <g
      data-testid={`turn-${kind}`}
      transform={`translate(${vp.X(p[0])} ${vp.Y(p[1])}) scale(${vp.u})`}
      pointerEvents={editable ? 'all' : 'none'}
      style={{ cursor: editable ? 'grab' : 'default' }}
      onPointerDown={drag(kind)}
    >
      <circle r={isCoarse ? 22 : 14} fill="transparent" />
      <rect x={-6} y={-6} width={12} height={12} rx={2} fill="#fff" stroke={COLOR} strokeWidth={2.5} />
    </g>
  );
  return (
    <g>
      <polygon
        points={corners.map(px).join(' ')}
        fill={COLOR}
        fillOpacity={0.08}
        stroke={COLOR}
        strokeWidth={2}
        strokeDasharray="7 5"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {handle(pt(L, 0), 'length')}
      {handle(pt(L / 2, W / 2), 'width')}
    </g>
  );
}
