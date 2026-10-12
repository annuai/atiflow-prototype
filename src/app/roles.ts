import type { Role } from '@/features/auth/types';

/** Role registry: landing route + sidebar header label. Add a role here (and in features/auth/types.ts) to scale. */
export const ROLES: Record<Role, { home: string; label: string }> = {
  supervisor: { home: '/supervisor/dashboard', label: 'SUPERVISOR' },
  configurator: { home: '/configurator', label: 'CONFIGURATOR' },
};
export const homeFor = (role: Role) => ROLES[role].home;
