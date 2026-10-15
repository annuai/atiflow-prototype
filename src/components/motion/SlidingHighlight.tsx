import { motion } from 'motion/react';
import { MOTION } from './tokens';

/** A highlight that exists once and glides to whichever item currently renders it (same `id` everywhere, inside one `LayoutGroup`). Style it with `className`. */
export const SlidingHighlight = ({ id, className }: { id: string; className?: string }) => (
  <motion.i className={className} layoutId={id} transition={MOTION.highlight} />
);
