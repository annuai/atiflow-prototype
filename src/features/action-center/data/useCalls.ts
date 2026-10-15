import { useMemo } from 'react';
import { useAuth } from '@/features/auth';
import { inScope, useActionState } from './store';
import type { Call } from '../model/types';

/** Open / acknowledged calls and the resolved log, for the signed-in person (their fleets only), most urgent first. */
export function useCalls(): { active: Call[]; log: Call[]; mine: Call[]; open: number } {
  const s = useActionState();
  const me = useAuth((x) => x.user?.name);
  return useMemo(() => {
    const active = s.active
      .filter(inScope)
      .sort((a, b) => (a.severity === b.severity ? a.openedAt - b.openedAt : a.severity === 'critical' ? -1 : 1));
    return {
      active,
      log: s.log.filter(inScope),
      mine: active.filter((c) => c.claimedBy === me),
      open: active.filter((c) => c.status === 'open').length,
    };
  }, [s, me]);
}
