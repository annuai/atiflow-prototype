import type { ComponentPropsWithRef } from 'react';
import { cx } from '@/utils/cx';

/**
 * THE page card: the big rounded white box every page puts its content in (under the title block, or the robot page's header band). One component owns its radius, border, shadow, background,
 * its 12 px of room above and below and its flex column, so no page can end at a different height or have a different corner by drawing its own: a page passes only what is really its own
 * (`className`, e.g. its padding or `overflow-y-auto`), and those are merged over the defaults (tailwind-merge). The values come from the design tokens (`--r-lg`, `--border-secondary`...).
 * `data-page-card` is the stable hook for tests and for CSS that has to find the card (never a class name: classes are for styling).
 */
export function PageCard({ className, children, ...rest }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-page-card
      {...rest}
      className={cx(
        'my-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-(--r-lg) border border-(--border-secondary) bg-(--bg-primary) shadow-(--shadow-xs)',
        className,
      )}
    >
      {children}
    </div>
  );
}
