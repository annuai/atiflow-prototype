import type { PointerEvent as ReactPointerEvent } from 'react';
import { isCoarse } from '@/components/map/useTouchGestures';
import {
  HANDLES,
  centreOf,
  flipGate,
  gateNormal,
  moveShape,
  resizeRect,
  rotateHandleAt,
  rotateRectTo,
  toWorld,
  type Handle,
} from '../../model/shape';
import type { MapZone, ZoneShape } from '../../model/types';
import { zoneType } from '../../model/zoneTypes';
import type { useViewport } from '../useViewport';

/** The mouse pointer over the rotate handle (and while it is dragged): a circular arrow, hot spot in its middle. */
const ROTATE_ARROW =
  "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke-linecap='round' stroke-linejoin='round'>" +
  ['white;4.6', '%23111;2']
    .map((c) => {
      const [color, w] = c.split(';');
      return `<g stroke='${color}' stroke-width='${w}'><path d='M20 12a8 8 0 1 1-2.6-5.9'/><path d='M20 4v4.5h-4.5'/></g>`;
    })
    .join('') +
  '</svg>';
export const ROTATE_CURSOR = `url("data:image/svg+xml,${ROTATE_ARROW.replace(/"/g, "'").replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')}") 12 12, grab`;

type Vp = ReturnType<typeof useViewport>;
type P = [number, number];
type Grab =
  { kind: 'move' } | { kind: 'resize'; handle: Handle } | { kind: 'rotate' } | { kind: 'end'; which: 'a' | 'b' };

/**
 * The handles of the selected zone of a draft: drag the body to move it, the eight squares to resize (a corner keeps the opposite corner still, Shift keeps the proportions), the round
 * handle on the stick to rotate (Shift snaps to 15 degrees). A Line gate has a handle on each end of its line and an arrow in the middle: click the arrow to flip the side it applies to.
 * Sizes are in pixels (`vp.u` is metres per pixel), bigger on a touch screen. A drag is one undo step (the editor merges edits with the same key).
 */
export function ZoneHandles({
  zone,
  vp,
  editable,
  bodyDrag,
  onShape,
}: {
  zone: MapZone;
  vp: Vp;
  editable: boolean;
  /** the body can be dragged (not while a drawing tool is armed: a click there places a point) */
  bodyDrag: boolean;
  onShape(id: string, shape: ZoneShape): void;
}) {
  const coarse = isCoarse;
  const px = (n: number) => n * vp.u * (coarse ? 1.6 : 1);
  const t = zoneType(zone.type);
  const s = zone.shape;
  const pt = (p: P) => `${vp.X(p[0]).toFixed(3)},${vp.Y(p[1]).toFixed(3)}`;
  const outline = zone.polygon.map(pt).join(' ');

  const begin = (e: ReactPointerEvent, grab: Grab) => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    const start = vp.toSite(e.clientX, e.clientY);
    const from = zone.shape;
    const emit = (shape: ZoneShape) => onShape(zone.id, shape);
    const move = (ev: PointerEvent) => {
      const at = vp.toSite(ev.clientX, ev.clientY);
      const p: P = [at.x, at.y];
      if (grab.kind === 'move') return emit(moveShape(from, at.x - start.x, at.y - start.y));
      if (grab.kind === 'end' && from.kind === 'gate')
        return emit({ ...from, [grab.which]: [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100] });
      if (from.kind !== 'rect') return;
      if (grab.kind === 'resize') return emit(resizeRect(from, grab.handle, p, ev.shiftKey));
      if (grab.kind === 'rotate') return emit(rotateRectTo(from, p, ev.shiftKey));
    };
    // while the rotate handle is dragged the whole page shows the rotate cursor (the pointer is no longer over the handle)
    const cursorStyle = document.createElement('style');
    if (grab.kind === 'rotate') {
      cursorStyle.textContent = `* { cursor: ${ROTATE_CURSOR} !important; }`;
      document.head.appendChild(cursorStyle);
    }
    const end = () => {
      cursorStyle.remove();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  const sq = px(4.5);
  const line = { stroke: t.color, strokeWidth: 1.6, vectorEffect: 'non-scaling-stroke' as const };
  const grip = {
    fill: '#fff',
    stroke: t.color,
    strokeWidth: 1.6,
    vectorEffect: 'non-scaling-stroke' as const,
    style: { cursor: editable ? 'pointer' : 'default' },
  };
  return (
    <g data-testid="zone-handles">
      {bodyDrag && (
        <polygon
          points={outline}
          fill="transparent"
          stroke="none"
          style={{ cursor: editable ? 'move' : 'default' }}
          onPointerDown={(e) => begin(e, { kind: 'move' })}
        />
      )}
      <polygon points={outline} fill="none" {...line} pointerEvents="none" />
      {editable && s.kind === 'rect' && (
        <>
          {(() => {
            const top = toWorld(s, 0, s.h / 2),
              knob = rotateHandleAt(s, px(26));
            return (
              <>
                <line
                  x1={vp.X(top[0])}
                  y1={vp.Y(top[1])}
                  x2={vp.X(knob[0])}
                  y2={vp.Y(knob[1])}
                  {...line}
                  pointerEvents="none"
                />
                <circle
                  data-handle="rotate"
                  cx={vp.X(knob[0])}
                  cy={vp.Y(knob[1])}
                  r={px(5.5)}
                  {...grip}
                  style={{ cursor: ROTATE_CURSOR }}
                  onPointerDown={(e) => begin(e, { kind: 'rotate' })}
                />
              </>
            );
          })()}
          {HANDLES.map((h) => {
            const [x, y] = toWorld(s, (h[0] * s.w) / 2, (h[1] * s.h) / 2);
            return (
              <rect
                key={h.join()}
                data-handle={`resize:${h.join(',')}`}
                x={vp.X(x) - sq}
                y={vp.Y(y) - sq}
                width={sq * 2}
                height={sq * 2}
                {...grip}
                onPointerDown={(e) => begin(e, { kind: 'resize', handle: h })}
              />
            );
          })}
        </>
      )}
      {s.kind === 'gate' && (
        <>
          {editable &&
            (['a', 'b'] as const).map((w) => (
              <circle
                key={w}
                data-handle={`end:${w}`}
                cx={vp.X(s[w][0])}
                cy={vp.Y(s[w][1])}
                r={px(6)}
                {...grip}
                onPointerDown={(e) => begin(e, { kind: 'end', which: w })}
              />
            ))}
          <g
            data-handle="flip"
            style={{ cursor: editable ? 'pointer' : 'default' }}
            onPointerDown={(e) => {
              if (!editable) return;
              e.stopPropagation();
              onShape(zone.id, flipGate(s));
            }}
          >
            <circle
              cx={vp.X(centreOf(s)[0] + gateNormal(s)[0] * px(14))}
              cy={vp.Y(centreOf(s)[1] + gateNormal(s)[1] * px(14))}
              r={px(13)}
              fill="transparent"
            />
          </g>
        </>
      )}
    </g>
  );
}
