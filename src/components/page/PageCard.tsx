import type { ComponentPropsWithRef } from 'react';
import { cx } from '@/utils/cx';

type Div = ComponentPropsWithRef<'div'>;

/**
 * THE page card: the big rounded white box every page puts its content in (under the title block, or the robot page's header band). One component owns its radius, border, shadow, background,
 * its 12 px of room above and below and its flex column, so no page can end at a different height or have a different corner by drawing its own: a page passes only what is really its own
 * (`className`, e.g. its padding or `overflow-y-auto`), and those are merged over the defaults (tailwind-merge). The values come from the design tokens (`--r-lg`, `--border-secondary`...).
 * `data-page-card` is the stable hook for tests and for CSS that has to find the card (never a class name: classes are for styling).
 */
export function PageCard({ className, children, ...rest }: Div) {
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

/** The side padding of a card's body AND of the bar above it: one definition, so a tab bar's left edge always lines up with the headings below it. */
const SIDE = 'px-5 max-[720px]:px-3';

/**
 * The scrolling body of a page card: a padded column that scrolls by itself. `spacious` is the roomier padding of the dashboard-style pages (cards of numbers and lists).
 * `--table-sticky-top` pulls a table heading up by the padding, because a sticky offset starts inside it (the heading then sticks to the very top of the card).
 * Children of a grid in it may shrink (`min-w-0`), or a one-column grid on a phone grows to its widest content and sticks out of the screen.
 */
export const CARD_BODY =
  'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-4 pb-5 [--table-sticky-top:-16px] max-[720px]:py-3 max-[720px]:[--table-sticky-top:-12px] [&_.grid>*]:min-w-0 ' +
  SIDE;
export function PageCardBody({ className, spacious, ...rest }: Div & { spacious?: boolean }) {
  return (
    <div
      data-card-body
      {...rest}
      className={cx(CARD_BODY, spacious && 'px-5 py-5 sm:px-6 max-[720px]:px-5 max-[720px]:py-5', className)}
    />
  );
}

/** A bar above a card's scrolling body (a tab switch): the same side padding as the body. */
export function PageCardBar({ className, ...rest }: Div) {
  return <div data-card-bar {...rest} className={cx('flex-none pt-4 max-[720px]:pt-3', SIDE, className)} />;
}

/**
 * A header bar inside a card (Live Floor, Workflow Builder): as tall as its controls need, with the room above, below and after the last control always `--bar-inset` (so the gap after
 * the last button is the same as above it, whatever size the controls are). The left side keeps 16 px (12 on a phone) for the title.
 */
export function PageCardHeader({ className, ...rest }: Div) {
  return (
    <div
      data-card-header
      {...rest}
      className={cx(
        'flex min-h-[52px] flex-none items-center gap-2 border-b border-(--border-secondary) py-(--bar-inset) pr-(--bar-inset) pl-4 max-[720px]:pl-3',
        className,
      )}
    />
  );
}
