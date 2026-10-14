import { Badge } from '@/components/base/badges/badges';
import { STATUS } from '../model/status';
import type { RequestStatus } from '../model/types';

export const RequestStatusBadge = ({ status, size = 'md' }: { status: RequestStatus; size?: 'sm' | 'md' | 'lg' }) => <Badge size={size} type="pill-color" color={STATUS[status].color}>{STATUS[status].label}</Badge>;
