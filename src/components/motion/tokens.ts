/**
 * THE motion settings of the app: every duration, easing, distance and spring lives here, so the feel of the whole product is changed in one place.
 * The components in this folder (and the skeleton helpers) read it; nothing else hard-codes a number.
 */
export const MOTION = {
  /** Page change: the old page leaves, the new one arrives (seconds, pixels). */
  page: { enter: { duration: 0.2, ease: 'easeOut', rise: 10 }, exit: { duration: 0.12, ease: 'easeIn', lift: -6 } },
  /** Dim layer behind the mobile menu. */
  scrim: { duration: 0.2 },
  /** The sidebar highlight that slides between items. */
  highlight: { type: 'spring', stiffness: 520, damping: 42 },
  /** Tabs: the content of the chosen tab fades in (the old content leaves at once, so a switch never waits); the line under (or beside) the tabs glides to the chosen one. */
  tab: {
    enter: { duration: 0.15, ease: 'easeOut' },
    indicator: { duration: 0.2, ease: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  },
  /** A number (badge) that changed. */
  pop: { from: 0.6, spring: { type: 'spring', stiffness: 520, damping: 14 } },
  /** Skeletons: nothing for `delay` ms (fast loads never flash one), then at least `min` ms (slow ones never blink). */
  skeleton: { delay: 150, min: 300 },
} as const;
