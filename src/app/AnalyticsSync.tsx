import { useEffect } from 'react';
import { useAuth } from '@/features/auth';
import { identifyPerson } from '@/platform';

/** Tells analytics who is signed in (username and role only), so recordings can be matched to a tester. Renders nothing. */
export function AnalyticsSync() {
  const user = useAuth((s) => s.user);
  const id = user?.username ?? null;
  const role = user?.role ?? '';
  useEffect(() => {
    identifyPerson(id ? { id, role } : null);
  }, [id, role]);
  return null;
}
