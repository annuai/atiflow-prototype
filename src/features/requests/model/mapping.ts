import { useMemo } from 'react';
import { can } from '@/features/access';
import { toPublic, userDirectory, useUsers } from '@/features/auth/userDirectory';
import type { UserRecord } from '@/features/auth/types';
import type { ApproversAt } from './rules';

/** Usernames of the people mapped to a station who hold a permission (pure). The mapping itself is edited on the Users page (`stations` of an operator). */
export const operatorsAt = (users: UserRecord[], stationId: string, permission: 'operator.request' | 'operator.approve'): string[] => users.filter((u) => u.stations?.includes(stationId) && can(toPublic(u), permission)).map((u) => u.username);
export const approversFrom = (users: UserRecord[]): ApproversAt => (stationId) => operatorsAt(users, stationId, 'operator.approve');
/** Outside React (notifications, publish check). */
export const approversNow = (): ApproversAt => approversFrom(userDirectory.getState().users);
/** For components: who approves at which station, following the user list. */
export function useApproversAt(): ApproversAt { const users = useUsers((s) => s.users); return useMemo(() => approversFrom(users), [users]); }
