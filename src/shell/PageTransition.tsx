import { Suspense, useContext, useState, type ReactNode } from 'react';
import { UNSAFE_LocationContext, useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, useIsPresent } from 'motion/react';
import { PageMotion } from '@/components/motion/PageMotion';
import { pageKey } from './pageKey';
import { PageErrorBoundary } from './PageErrorBoundary';
import { PageSkeleton } from './PageSkeleton';

/**
 * While a page animates out, React Router already points at the NEW location, so the old page would re-render with it. This keeps the old page on the
 * location it was shown with until it is gone; a page that stays (a tab change inside it) keeps following the real location.
 */
function Frozen({ children }: { children: ReactNode }) {
  const loc = useContext(UNSAFE_LocationContext);
  const present = useIsPresent();
  const [held, setHeld] = useState(loc);
  if (present && held !== loc) setHeld(loc); // follow the real location while the page is shown; once it is leaving, keep the last one
  return <UNSAFE_LocationContext.Provider value={present ? loc : held}>{children}</UNSAFE_LocationContext.Provider>;
}

/** Page changes: the old page fades out and lifts a little, the new one rises in. Only the content area moves; the sidebar and top bar stay (they live in the layout above). */
export function PageTransition() {
  const outlet = useOutlet();
  const key = pageKey(useLocation().pathname);
  return (
    <AnimatePresence mode="wait" initial={false}>
      <PageMotion key={key} className="page-frame">
        <Frozen>
          <PageErrorBoundary>
            <Suspense fallback={<PageSkeleton />}>{outlet}</Suspense>
          </PageErrorBoundary>
        </Frozen>
      </PageMotion>
    </AnimatePresence>
  );
}
