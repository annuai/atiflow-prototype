import { useEffect, useState } from 'react';
import type { Vec2 } from '@/core/types';
import { simBus, type Frame } from '../sim/tripSim';
import type { useViewport } from './useViewport';

type Vp = ReturnType<typeof useViewport>;
export interface SimMark { p: Vec2; kind: 'start' | 'end' }
/** The simulation on the map (drawn inside the map's SVG): the start / end rings, the route (dashed while driven, solid once done) and the robot. Updates itself, so a moving robot never re-draws the whole map. */
export function SimLayer({ vp, marks }: { vp: Vp; marks: SimMark[] }) {
  const [route, setRoute] = useState<{ cur: Vec2[] | null; done: Vec2[][] }>({ cur: null, done: [] }); const [robot, setRobot] = useState<{ p: Vec2; heading: number } | null>(null);
  useEffect(() => simBus.on((f: Frame) => { if (f.type === 'reset') { setRoute({ cur: null, done: [] }); setRobot(null); } else if (f.type === 'route') setRoute({ cur: f.cur, done: f.done }); else setRobot({ p: f.p, heading: f.heading }); }), []);
  const line = (pts: Vec2[]) => pts.map((p) => `${vp.X(p.x).toFixed(2)},${vp.Y(p.y).toFixed(2)}`).join(' ');
  return (
    <g pointerEvents="none">
      {route.done.map((d, i) => <polyline key={i} points={line(d)} fill="none" stroke="#14b8a6" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} vectorEffect="non-scaling-stroke" />)}
      {route.cur && <polyline points={line(route.cur)} fill="none" stroke="#0d9488" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="7 5" vectorEffect="non-scaling-stroke" />}
      {marks.map((m) => <circle key={m.kind} cx={vp.X(m.p.x)} cy={vp.Y(m.p.y)} r={11 * vp.u} fill="none" stroke={m.kind === 'start' ? '#16a34a' : '#dc2626'} strokeWidth={3} vectorEffect="non-scaling-stroke" />)}
      {robot && (
        <g transform={`translate(${vp.X(robot.p.x)} ${vp.Y(robot.p.y)}) scale(${vp.u}) rotate(${(-robot.heading * 180) / Math.PI})`} aria-label="Robot">
          <rect x={-9} y={-6} width={18} height={12} rx={3} fill="#fcd900" stroke="#111827" strokeWidth={1.4} />
          <rect x={4} y={-4.6} width={3.6} height={9.2} rx={1} fill="#111827" /><circle cx={-2} cy={0} r={2.4} fill="#f58a1f" />
        </g>
      )}
    </g>
  );
}
