import { BadgeWithDot } from '@/components/base/badges/badges';
import type { DeviceStatus } from '../model/types';
import { t } from '../text';

const COLOR = { online: 'success', offline: 'error' } as const;
/** Online / Offline pill shared by the list rows and the detail header. */
export const StatusBadge = ({ status, type = 'color' }: { status: DeviceStatus; type?: 'color' | 'pill-color' }) => (
  <BadgeWithDot size="sm" type={type} color={COLOR[status]}>
    {t.status[status]}
  </BadgeWithDot>
);
