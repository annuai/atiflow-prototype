import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { track } from '@/platform';
import { copy } from '../copy';
import { runTour } from '../engine/runner';
import { peopleStore, tourRequests, useTourRequest } from '../model/progress';
import { TOURS, isTourId, type TourId } from '../model/tours';
import './tour.css';

/**
 * Starts the walkthrough when something asks for it: a button (the welcome dialog, the user menu) through `tourRequests`, or a link with `?tour=configurator` in the address (the empty
 * Fleets page). Mounted once in the shell. Only one walkthrough runs at a time; how it ended is remembered for the person and counted in analytics.
 */
export function TourHost() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuth((s) => s.user?.username ?? null);
  const requested = useTourRequest();
  const stop = useRef<(() => void) | null>(null);
  const pathRef = useRef(location.pathname);
  useEffect(() => {
    pathRef.current = location.pathname;
  }, [location.pathname]);
  const fromUrl = params.get('tour');
  const want: TourId | null = isTourId(requested) ? requested : isTourId(fromUrl) ? fromUrl : null;
  useEffect(() => {
    if (!want) return;
    tourRequests.getState().clear();
    if (fromUrl) {
      params.delete('tour');
      setParams(params, { replace: true });
    }
    stop.current?.();
    const tour = TOURS[want];
    stop.current = runTour(tour, {
      navigate: (p) => navigate(p),
      path: () => pathRef.current,
      labels: {
        next: copy.tour.next,
        prev: copy.tour.prev,
        done: copy.tour.done,
        progress: copy.tour.progress,
      },
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      onEvent: (e) => {
        if (e.type === 'started') track('tour_started', { tour: tour.id });
        else if (e.type === 'step') track('tour_step', { tour: tour.id, step: e.stepId, index: e.index });
        else {
          track(e.type === 'done' ? 'tour_done' : 'tour_skipped', { tour: tour.id });
          if (user)
            peopleStore
              .getState()
              .patch(user, { tours: { ...peopleStore.getState().of(user).tours, [tour.id]: e.type } });
          stop.current = null;
        }
      },
    });
  }, [want]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stop.current?.(), []);
  return null;
}
