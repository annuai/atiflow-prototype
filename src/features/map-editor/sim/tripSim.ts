import { useEffect, useRef, useState } from 'react';
import type { Vec2 } from '@/core/types';
import { pointAlong } from '@/features/workflow-builder/sim/runner';
import type { TripPlan } from '../model/simulate';

/** What the simulation tells the map: the route being driven and driven already, and where the robot is. (Same idea as the workflow builder's simulation.) */
export type Frame = { type: 'route'; cur: Vec2[] | null; done: Vec2[][] } | { type: 'robot'; p: Vec2; heading: number } | { type: 'reset' };
const listeners = new Set<(f: Frame) => void>();
export const simBus = { on(fn: (f: Frame) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }, emit(f: Frame) { listeners.forEach((l) => l(f)); } };

export interface SimState { status: 'idle' | 'running' | 'done'; step: string; progress: number }
export const SIM_IDLE: SimState = { status: 'idle', step: '', progress: 0 };
const CANCEL = Symbol('cancel');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Starts, drives and stops one trip: start station -> end station along the map's lanes, like the workflow builder drives its stations. Stops by itself when the page goes away. */
export function useTripSimulation() {
  const [state, setState] = useState<SimState>(SIM_IDLE); const token = useRef(0);
  const reset = () => simBus.emit({ type: 'reset' });
  const stop = () => { token.current++; setState(SIM_IDLE); reset(); };
  useEffect(() => () => { token.current++; reset(); }, []);
  const run = async (plan: Extract<TripPlan, { ok: true }>, robot: string, from: string, to: string) => {
    token.current++; const tok = token.current; const alive = () => { if (tok !== token.current) throw CANCEL; };
    const say = (step: string, progress?: number) => setState((s) => ({ ...s, step, ...(progress === undefined ? {} : { progress }) }));
    reset(); setState({ status: 'running', step: '', progress: 0 });
    try {
      say(`${robot}: starting at ${from}`, 2); simBus.emit({ type: 'robot', p: plan.pts[0], heading: pointAlong(plan.pts, 0).heading }); await sleep(600); alive();
      simBus.emit({ type: 'route', cur: plan.pts, done: [] }); say(`${robot}: driving to ${to}, ${Math.round(plan.len)} m`);
      const dur = Math.min(6000, 1200 + plan.len * 45), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      await new Promise<void>((res, rej) => {
        let t0: number | null = null;
        const step = (ts: number) => {
          if (tok !== token.current) return rej(CANCEL); if (t0 === null) t0 = ts;
          const k = reduce ? 1 : Math.min(1, (ts - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; const { p, heading } = pointAlong(plan.pts, e * plan.len);
          simBus.emit({ type: 'robot', p, heading }); setState((s) => ({ ...s, progress: 5 + 90 * e })); if (k < 1) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
      });
      simBus.emit({ type: 'route', cur: null, done: [plan.pts] }); say(`${robot}: arrived at ${to}`, 100); await sleep(500); alive();
      setState({ status: 'done', step: '', progress: 100 });
    } catch (e) { if (e !== CANCEL) throw e; }
  };
  return { state, run, stop };
}
