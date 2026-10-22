import { useSearchParams } from 'react-router-dom';
import { activeProfile } from '@/data/profile';
import { useAuth } from '@/features/auth';
import { track } from '@/platform';
import { WELCOME_VERSION, peopleStore, tourRequests, usePerson } from '../model/progress';
import type { TourId } from '../model/tours';
import { WelcomeDialog } from './WelcomeDialog';

/**
 * Shows the welcome dialog once per person: the first time they open a workspace of a blank site (a site that starts with demo data does not interrupt anyone: it can be asked for with
 * `?welcome=1`). Start Walkthrough begins that workspace's tour; both choices are remembered for the person.
 */
export function WelcomeHost({ workspace }: { workspace: TourId }) {
  const user = useAuth((s) => s.user?.username ?? null);
  const person = usePerson(user);
  const [params, setParams] = useSearchParams();
  const forced = params.get('welcome') === '1';
  const due = !!user && !activeProfile().starterData && person.welcomed !== WELCOME_VERSION;
  const open = due || forced;
  const close = (start: boolean) => {
    if (params.has('welcome')) {
      params.delete('welcome');
      setParams(params, { replace: true });
    }
    if (user) peopleStore.getState().patch(user, { welcomed: WELCOME_VERSION });
    track(start ? 'welcome_start' : 'welcome_skip', { workspace });
    if (start) tourRequests.getState().start(workspace);
  };
  return <WelcomeDialog isOpen={open} onStart={() => close(true)} onSkip={() => close(false)} />;
}
