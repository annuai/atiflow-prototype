import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { MOTION } from './tokens';

/** Wrap what enters and leaves with a page change: it fades and rises in, fades and lifts out. Must be the direct child of an `AnimatePresence`. */
export function PageMotion({ children, className }: { children: ReactNode; className?: string }) {
  const { enter, exit } = MOTION.page;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: enter.rise }}
      animate={{ opacity: 1, y: 0, transition: { duration: enter.duration, ease: enter.ease } }}
      exit={{ opacity: 0, y: exit.lift, transition: { duration: exit.duration, ease: exit.ease } }}
    >
      {children}
    </motion.div>
  );
}
