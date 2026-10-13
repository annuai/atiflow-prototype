import { Badge } from '@/components/base/badges/badges';
import { roleById, type RoleId } from '@/features/access';

const COLOR: Record<RoleId, 'brand' | 'blue' | 'purple' | 'orange'> = { configurator: 'brand', supervisor: 'blue', 'line-supervisor': 'purple', operator: 'orange' };
export const RoleBadge = ({ role, size = 'md' }: { role: RoleId; size?: 'sm' | 'md' }) => <Badge size={size} type="pill-color" color={COLOR[role]}>{roleById(role).label}</Badge>;
