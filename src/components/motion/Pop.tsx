import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { MOTION } from './tokens';

/** Gives its content a small springy pop each time `trigger` changes (a count that went up or down). */
export const Pop = ({ trigger, className, children }: { trigger: string | number; className?: string; children: ReactNode }) => (
  <motion.span key={trigger} className={className} initial={{ scale: MOTION.pop.from }} animate={{ scale: 1 }} transition={MOTION.pop.spring}>{children}</motion.span>
);
