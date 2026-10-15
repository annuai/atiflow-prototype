import { needsAttention } from '@/core/stats';
import type { RobotTelemetry } from '@/core/types';

/** The four colours of the small floor map (Live Status): moving, idle, charging, needs attention. */
export type MapColor = 'moving' | 'idle' | 'charging' | 'attention';
export const MAP_COLORS: Record<MapColor, string> = {
  moving: '#14b8a6',
  idle: '#94a3b8',
  charging: '#22c55e',
  attention: '#ef4444',
};
export const mapStateOf = (r: RobotTelemetry): MapColor =>
  needsAttention(r)
    ? 'attention'
    : r.state === 'charging'
      ? 'charging'
      : r.state === 'idle' || r.state === 'offline' || r.state === 'paused'
        ? 'idle'
        : 'moving';
