import { useMemo } from 'react';
import { isCoarse } from '@/components/map/useTouchGestures';
import { nearestRoad } from '../../model/connect';
import { useApproachFocus } from '../../model/approach/focus';
import { approachPath, inlaneFromPoint, laneAt, perpFromPoint } from '../../model/approach/geometry';
import { resolveNodes, slotOf } from '../../model/approach/nodes';
import { roleOf, type SlotId } from '../../model/approach/types';
import type { MapData } from '../../model/types';
import type { useViewport } from '../useViewport';

type Vp = ReturnType<typeof useViewport>;
const COLOR = '#0d9488';
/**
 * The path of the slot being looked at (Pick, Drop, Laden or Unladen of one node), drawn from the same distances the panel edits, with two handles: one slides along the lane (where the maneuver
 * starts), one in front of the station (where it ends). Dragging a handle changes that distance, one undo step per drag. The reverse part of a maneuver is dashed.
 */
export function ApproachGhost({
  data,
  stationId,
  vp,
  editable,
  onParams,
}: {
  data: MapData;
  stationId: string | null;
  vp: Vp;
  editable: boolean;
  /** the distances changed by a handle (key = station:node:slot) */
  onParams(stationId: string, node: number, slot: SlotId, params: Record<string, number>): void;
}) {
  const focus = useApproachFocus();
  const shape = useMemo(() => {
    if (!stationId || focus.station !== stationId || !focus.slot) return null;
    const s = data.stations.find((q) => q.id === stationId);
    if (s?.onLane !== false) return null; // approach paths belong to a station off the route
    const here = s && data.nodes.find((n) => n.id === s.nodeId);
    const r = s && resolveNodes(data, s)[focus.node];
    const slot = r && slotOf(r.node, focus.slot);
    if (!s || !here || !r?.at || !slot) return null;
    const road = nearestRoad(data, r.at.x, r.at.y);
    if (!road) return null;
    const theta = ((s.angle ?? 0) * Math.PI) / 180;
    const input = {
      role: roleOf(focus.slot),
      slot,
      node: [r.at.x, r.at.y] as [number, number],
      lane: laneAt(road.road.points, road.seg),
      station: [here.x, here.y] as [number, number],
      theta,
    };
    return { input, path: approachPath(input), node: focus.node, slot: focus.slot };
  }, [data, stationId, focus.station, focus.node, focus.slot]);
  if (!shape) return null;
  const { input, path } = shape;
  const px = (p: [number, number]) => `${vp.X(p[0])},${vp.Y(p[1])}`;
  const split = path.reverseFrom ?? path.pts.length;
  const line = (pts: [number, number][]) => pts.map(px).join(' ');
  const drag = (kind: 'inlane' | 'perp') => (e: React.PointerEvent) => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const p = vp.toSite(ev.clientX, ev.clientY);
      const q: [number, number] = [p.x, p.y];
      onParams(
        stationId!,
        shape.node,
        shape.slot,
        kind === 'inlane'
          ? { inlane_dist: inlaneFromPoint(input.role, input.node, input.lane, q) }
          : { perpendicular_dist: perpFromPoint(input.station, input.theta, q) },
      );
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
  const handle = (at: [number, number], kind: 'inlane' | 'perp', label: string) => (
    <g
      key={kind}
      data-testid={`approach-${kind}`}
      transform={`translate(${vp.X(at[0])} ${vp.Y(at[1])}) scale(${vp.u})`}
      pointerEvents={editable ? 'all' : 'none'}
      style={{ cursor: editable ? 'grab' : 'default' }}
      onPointerDown={drag(kind)}
    >
      <circle r={isCoarse ? 22 : 14} fill="transparent" />
      <circle r={7} fill="#fff" stroke={COLOR} strokeWidth={2.5} />
      <title>{label}</title>
    </g>
  );
  return (
    <g>
      <g pointerEvents="none">
        {path.reverseFrom !== undefined && path.reverseFrom > 0 && (
          <polyline
            points={line(path.pts.slice(0, split + 1))}
            fill="none"
            stroke={COLOR}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <polyline
          points={line(path.reverseFrom !== undefined && path.reverseFrom > 0 ? path.pts.slice(split) : path.pts)}
          fill="none"
          stroke={COLOR}
          strokeWidth={4}
          strokeDasharray={path.reverseFrom !== undefined ? '7 5' : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {path.marks.map((m, i) => (
          <g key={i} transform={`translate(${vp.X(m.at[0])} ${vp.Y(m.at[1])}) scale(${vp.u})`}>
            <circle r={9} fill="#fff" stroke={COLOR} strokeWidth={2.5} />
            {m.kind === 'rotate' ? (
              <path
                d="M-4 -1 A4.5 4.5 0 1 1 0 4.5 M-4 -1 L-6 -4 M-4 -1 L-1 -3"
                fill="none"
                stroke={COLOR}
                strokeWidth={1.6}
                strokeLinecap="round"
              />
            ) : (
              <rect x={-3.5} y={-3.5} width={7} height={7} fill={COLOR} />
            )}
          </g>
        ))}
      </g>
      {handle(path.inlaneAt, 'inlane', '')}
      {handle(path.perpAt, 'perp', '')}
    </g>
  );
}
