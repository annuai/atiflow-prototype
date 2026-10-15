import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, PresenceContext } from 'motion/react';
import { cx } from '@/utils/cx';
import { MOTION } from './tokens';

/**
 * Wrap the content of a tab (or a segmented switch / filter) with the key of the chosen tab: when the key changes the new content fades in. Enter only, on purpose: the old
 * content is replaced at once, so a switch never waits and the content never renders against the new route or state while it leaves. The first render is not animated.
 */
export function TabPanelMotion({
  tabKey,
  className,
  fill,
  children,
}: {
  tabKey: string;
  className?: string;
  /** the panel fills a page card's scroll body and lays its children out in a column, as the card body does (`.md-body`) */
  fill?: boolean;
  children: ReactNode;
}) {
  const { duration, ease } = MOTION.tab.enter;
  // the first tab is already on screen when the page arrives: only a CHANGE of tab animates
  const [shown, setShown] = useState(tabKey);
  const [changed, setChanged] = useState(false);
  if (shown !== tabKey) {
    setShown(tabKey);
    setChanged(true);
  }
  // a new tab starts at the top of whatever scrolls around it
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (changed) box.current?.parentElement?.scrollTo({ top: 0 });
  }, [tabKey, changed]);
  return (
    // a page change runs inside `AnimatePresence initial={false}`, which would also switch off the enter animation of everything mounted later inside the page: the tab panel steps out of it
    <PresenceContext.Provider value={null}>
      <motion.div
        key={tabKey}
        ref={box}
        className={cx(fill && 'flex min-h-0 flex-1 flex-col gap-4', className)}
        initial={changed ? { opacity: 0 } : false}
        animate={{ opacity: 1, transition: { duration, ease } }}
      >
        {children}
      </motion.div>
    </PresenceContext.Provider>
  );
}
