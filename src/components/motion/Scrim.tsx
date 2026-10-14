import { motion } from 'motion/react';
import { MOTION } from './tokens';

/** A dim layer that fades in and out behind an overlay (put it inside an `AnimatePresence`). Style it with `className`. */
export const Scrim = ({ className, onClick }: { className?: string; onClick?: () => void }) => (
  <motion.div className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: MOTION.scrim.duration }} onClick={onClick} />
);
