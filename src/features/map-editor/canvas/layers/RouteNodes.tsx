import type { PointerEvent as ReactPointerEvent } from 'react';
import { isCoarse } from '@/components/map/useTouchGestures';
import { routeNodes } from '../../model/routes';
import type { MapRoad } from '../../model/types';
import type { useViewport } from '../useViewport';

type Vp = ReturnType<typeof useViewport>;
const COLOR = '#0d9488';

/**
 * The bend nodes of the selected route of a point-to-point (v2) map, shown only while the route is selected (like the Deployment Manager): click one to select it (its curve radius is then
 * in the side panel), drag it to bend the route. Double-click the route itself to add a node (the map does that). Sizes are pixels, bigger on a touch screen.
 */
export function RouteNodes({
  road,
  selected,
  vp,
  editable,
  onSelect,
  onMove,
}: {
  road: MapRoad;
  selected: number | undefined;
  vp: Vp;
  editable: boolean;
  onSelect(index: number): void;
  onMove(index: number, to: [number, number]): void;
}) {
  const begin = (e: ReactPointerEvent, index: number) => {
    e.stopPropagation(); // not a pan of the map
    onSelect(index);
    if (!editable) return;
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const p = vp.toSite(ev.clientX, ev.clientY);
      onMove(index, [p.x, p.y]);
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
  return (
    <g data-testid="route-nodes">
      {routeNodes(road).map(([x, y], i) => (
        <g
          key={i}
          transform={`translate(${vp.X(x)} ${vp.Y(y)}) scale(${vp.u})`}
          style={{ cursor: editable ? 'move' : 'pointer' }}
          onPointerDown={(e) => begin(e, i)}
          data-testid="route-node"
        >
          <circle r={isCoarse ? 20 : 12} fill="transparent" />
          <circle
            r={7}
            fill={selected === i ? COLOR : '#fff'}
            stroke={COLOR}
            strokeWidth={2.4}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
    </g>
  );
}
