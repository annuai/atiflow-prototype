import type { BadgeColors } from '@/components/base/badges/badge-types';
import type { RobotState } from '../core/types';

/** Robot state -> Untitled UI badge colour. Single source for every status badge. */
export const STATE_TONE: Record<RobotState, BadgeColors> = {
  moving: 'brand',
  waiting: 'purple',
  working: 'warning',
  charging: 'success',
  blocked: 'error',
  error: 'error',
  idle: 'gray',
  offline: 'gray',
  paused: 'slate',
};
export type BarTone = 'brand' | 'success' | 'error';
export const BAR_CLASS: Record<BarTone, string | undefined> = {
  brand: undefined,
  success: 'bg-fg-success-primary',
  error: 'bg-fg-error-primary',
};
