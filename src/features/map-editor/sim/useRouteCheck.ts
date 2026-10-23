import { useRef, useState } from 'react';
import { checkRoutes, type RouteCheck } from '../model/checkRoutes';
import type { MapData } from '../model/types';

/** Runs "Check all routes" for the open map and keeps its progress and result. */
export function useRouteCheck(data: MapData | undefined, fleet: string) {
  const [state, setState] = useState<{
    status: 'idle' | 'running' | 'done';
    progress: number;
    result: RouteCheck | null;
  }>({
    status: 'idle',
    progress: 0,
    result: null,
  });
  const stop = useRef(false);
  return {
    ...state,
    async run(robots: string[]) {
      if (!data || !robots.length) return;
      stop.current = false;
      setState({ status: 'running', progress: 0, result: null });
      const result = await checkRoutes(data, {
        fleet,
        robots,
        shouldStop: () => stop.current,
        onProgress: (d, t) => setState((s) => ({ ...s, progress: t ? Math.round((d / t) * 100) : 100 })),
      });
      setState({ status: 'done', progress: 100, result });
    },
    stop() {
      stop.current = true;
    },
    clear() {
      setState({ status: 'idle', progress: 0, result: null });
    },
  };
}
