import { BadgeWithDot } from '@/components/base/badges/badges';
import type { DeviceStatus } from '../model/types';

const LOOK = { online: { label: 'Online', color: 'success' }, offline: { label: 'Offline', color: 'error' } } as const;
/** Online / Offline pill shared by the list rows and the detail header. */
export const StatusBadge = ({ status, type = 'color' }: { status: DeviceStatus; type?: 'color' | 'pill-color' }) => (
  <BadgeWithDot size="sm" type={type} color={LOOK[status].color}>
    {LOOK[status].label}
  </BadgeWithDot>
);
