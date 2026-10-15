import { useEffect } from 'react';
import { persistence, retryAll } from '@/data/persist';
import { notify } from '@/ui/toast';

/**
 * Tells the person when something they changed could not be saved (the persisters in `data/persist` gave up after their retries), and tries again when they come back to the tab.
 * Mount once. Renders nothing. A message appears once per failure; it is saved again by the next change, by coming back online or by returning to the tab.
 */
export function PersistenceNotice() {
  useEffect(() => {
    const seen = new Set<string>();
    const stop = persistence.subscribe(({ failed }) => {
      for (const [name, why] of Object.entries(failed))
        if (!seen.has(name)) {
          seen.add(name);
          notify.error(
            `Your changes to ${name} were not saved`,
            `${why} They stay on screen and will be saved when it works again.`,
            `persist-${name}`,
          );
        }
      for (const name of [...seen]) if (!(name in failed)) seen.delete(name);
    });
    const onVisible = () => document.visibilityState === 'visible' && retryAll();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return null;
}
