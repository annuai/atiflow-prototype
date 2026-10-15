import type { RobotState } from '../core/types';
// One table: state -> visuals (CLAUDE.md section 5).
export const STATE_COLOR: Record<RobotState, string> = {
  moving: '#14b8a6',
  waiting: '#a855f7',
  working: '#f59e0b',
  charging: '#22c55e',
  blocked: '#ef4444',
  error: '#dc2626',
  idle: '#94a3b8',
  offline: '#cbd5e1',
  paused: '#64748b',
};
export const STATE_PULSE: Record<RobotState, number> = {
  moving: 0.5,
  waiting: 1.4,
  working: 1.2,
  charging: 0.8,
  blocked: 3,
  error: 4,
  idle: 0,
  offline: 0,
  paused: 0,
};
