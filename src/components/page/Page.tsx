import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from '@/utils/cx';

type Div = ComponentPropsWithRef<'div'>;

/** The page frame: what sits beside the sidebar under the top bar. A column that fills the height, with the page's side padding (20 px, 12 on a phone). */
export function Page({ className, ...rest }: Div) {
  return <div data-page {...rest} className={cx('flex min-h-0 flex-1 flex-col px-5 max-[720px]:px-3', className)} />;
}

/** The page's title (the one `h1`). Exported because a page with a custom heading (a rename field, an avatar) still has to look like every other title. */
export function PageTitle({ className, ...rest }: ComponentPropsWithRef<'h1'>) {
  return (
    <h1
      {...rest}
      className={cx(
        'm-0 text-[24px] leading-[29px] font-bold tracking-[-0.3px] text-[#171717] max-[720px]:text-[20px] max-[720px]:leading-6',
        className,
      )}
    />
  );
}

/** The line under a title. Hidden on a phone, where the title row has to stay short. */
export function PageSubtitle({ className, ...rest }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      {...rest}
      className={cx('mt-1 mb-0 text-xs leading-4 text-(--text-placeholder) max-[720px]:hidden', className)}
    />
  );
}

/**
 * The title row of a page: title, a line under it and, on the right, the page's actions. One height (57 px, auto on a phone) for every page. A page with a custom left side (a rename field,
 * an avatar) passes it as `heading` (built from `PageTitle` / `PageSubtitle`); `actionsClassName` is for the few pages whose actions behave differently (hidden or full width on a phone).
 */
export function PageHeader({
  title,
  subtitle,
  heading,
  actions,
  actionsClassName,
  className,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  heading?: ReactNode;
  actions?: ReactNode;
  actionsClassName?: string;
  className?: string;
}) {
  return (
    <div
      data-page-header
      className={cx(
        'flex h-[57px] flex-none items-center justify-between px-1 max-[720px]:h-auto max-[720px]:px-0.5 max-[720px]:pt-1',
        className,
      )}
    >
      {heading ?? (
        <div>
          <PageTitle>{title}</PageTitle>
          {subtitle ? <PageSubtitle>{subtitle}</PageSubtitle> : null}
        </div>
      )}
      {actions ? <div className={cx('flex gap-3', actionsClassName)}>{actions}</div> : null}
    </div>
  );
}
