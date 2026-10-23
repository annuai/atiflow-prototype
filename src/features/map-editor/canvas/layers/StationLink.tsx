import { useMemo, type PointerEvent as ReactPointerEvent } from 'react';
import { routable } from '../../model/connect';
import { resolveNodes } from '../../model/approach/nodes';
import { localized } from '@/i18n';
import type { MapData } from '../../model/types';
import { isCoarse } from '@/components/map/useTouchGestures';
import type { useViewport } from '../useViewport';
import { ROTATE_CURSOR } from './ZoneHandles';

type Vp = ReturnType<typeof useViewport>;
const copy = localized('approach');

const LINK = '#7ea6c8'; // a soft blue: the link is a hint, not a thing to look at
const LINK_TEXT = '#5f87a8';
/**
 * How the selected station joins the route, drawn the way the Deployment Manager does: a thick purple line from the station to each route node it is joined to, the node a purple triangle
 * numbered N1, N2... (the order the file lists them in), and a dotted line to a small square that shows the way the robot faces. Drawn from the same on-the-fly connection the robots use
 * (`routable`), so it shows exactly where trips come in and go out.
 */
export function StationLink({
  data,
  stationId,
  vp,
  editable,
  onAngle,
}: {
  data: MapData;
  stationId: string | null;
  vp: Vp;
  editable: boolean;
  /** The way the station faces is changed with its rotate handle (degrees counter-clockwise from east; called while dragging). */
  onAngle(id: string, degrees: number): void;
}) {
  const shape = useMemo(() => {
    const net = routable(data);
    const s = net.stations.find((q) => q.id === stationId);
    const at = s && net.nodes.find((n) => n.id === s.nodeId);
    if (!s || !at) return null;
    // nodes belong to a station off the route; one on the route has none to show (it keeps its heading handle)
    const nodes =
      s.onLane === false
        ? resolveNodes(data, s).flatMap((r) =>
            r.at ? [{ ...r.at, badges: { park: !!r.node.roles.park, unpark: !!r.node.roles.unpark } }] : [],
          )
        : [];
    return { id: s.id, at, angle: s.angle, nodes };
  }, [data, stationId]);
  if (!shape) return null;
  const { id, at, nodes, angle } = shape;
  const ax = vp.X(at.x),
    ay = vp.Y(at.y);
  const a = ((angle ?? 0) * Math.PI) / 180;
  const reach = isCoarse ? 52 : 42;
  const rotate = (e: ReactPointerEvent) => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    const style = document.createElement('style'); // the whole page shows the rotate cursor while dragging
    style.textContent = `* { cursor: ${ROTATE_CURSOR} !important; }`;
    document.head.appendChild(style);
    const move = (ev: PointerEvent) => {
      const p = vp.toSite(ev.clientX, ev.clientY);
      let deg = (Math.atan2(p.y - at.y, p.x - at.x) * 180) / Math.PI;
      if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
      onAngle(id, Math.round(deg * 10) / 10);
    };
    const end = () => {
      style.remove();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };
  return (
    <g pointerEvents="none">
      {nodes.map((n, i) => {
        const nx = vp.X(n.x),
          ny = vp.Y(n.y);
        return (
          <g key={n.id}>
            <line
              x1={ax}
              y1={ay}
              x2={nx}
              y2={ny}
              stroke={LINK}
              strokeOpacity={0.85}
              strokeWidth={6}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <g transform={`translate(${nx} ${ny}) scale(${vp.u})`}>
              <path
                d="M0 -10L10 8H-10Z"
                fill="#fff"
                fillOpacity={0.6}
                stroke={LINK}
                strokeWidth={3}
                strokeLinejoin="round"
              />
              <text
                x={13}
                y={-4}
                fontSize={17}
                fontWeight={800}
                fill={LINK_TEXT}
                paintOrder="stroke"
                stroke="#fff"
                strokeWidth={3}
              >
                {`N${i + 1}`}
              </text>
              <text
                x={13}
                y={14}
                fontSize={13}
                fontWeight={700}
                fill={LINK_TEXT}
                paintOrder="stroke"
                stroke="#fff"
                strokeWidth={3}
              >
                {[n.badges.park && `↘ ${copy.badge.park}`, n.badges.unpark && `↗ ${copy.badge.unpark}`]
                  .filter(Boolean)
                  .join('  ')}
              </text>
            </g>
          </g>
        );
      })}
      <g transform={`translate(${ax} ${ay}) scale(${vp.u})`}>
        <line
          x1={0}
          y1={0}
          x2={Math.cos(a) * reach}
          y2={-Math.sin(a) * reach}
          stroke={LINK}
          strokeWidth={2}
          strokeDasharray="2 3"
          strokeLinecap="round"
        />
        <g
          transform={`translate(${Math.cos(a) * reach} ${-Math.sin(a) * reach})`}
          data-testid="station-rotate"
          pointerEvents={editable ? 'all' : 'none'}
          style={{ cursor: editable ? ROTATE_CURSOR : 'default' }}
          onPointerDown={rotate}
        >
          <circle r={isCoarse ? 20 : 13} fill="transparent" />
          <rect x={-6} y={-6} width={12} height={12} rx={2} fill="#fff" stroke={LINK} strokeWidth={2} />
        </g>
      </g>
      <g transform={`translate(${ax} ${ay}) scale(${vp.u})`}>
        <rect x={-14} y={-14} width={28} height={28} fill="none" stroke={LINK} strokeWidth={2} strokeDasharray="2 3" />
      </g>
    </g>
  );
}
