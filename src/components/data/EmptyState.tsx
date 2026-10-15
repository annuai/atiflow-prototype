import type { FC, ReactNode } from 'react';
import { SearchLg } from '@untitledui/icons';
import { cx } from '@/utils/cx';
import { localized } from '@/i18n';

const misc = localized('misc');

type Size = 'sm' | 'md' | 'lg';
const SIZE: Record<Size, { box: string; circle: string; icon: string; title: string; sub: string }> = {
  sm: { box: 'gap-1.5 px-4 py-6', circle: 'size-9', icon: 'size-5', title: 'text-sm', sub: 'text-xs' },
  md: { box: 'gap-2 px-6 py-10', circle: 'size-12', icon: 'size-6', title: 'text-md', sub: 'text-sm' },
  lg: { box: 'gap-2 px-6 py-16', circle: 'size-14', icon: 'size-7', title: 'text-lg', sub: 'text-sm' },
};

export interface EmptyStateProps {
  /** An Untitled UI icon (or any component that takes `className`). */
  icon: FC<{ className?: string }>;
  title: string;
  subtext?: ReactNode;
  /** Buttons that fix the emptiness ("Add the first robot"). */
  action?: ReactNode;
  /** Anything extra under the text (quick picks). */
  children?: ReactNode;
  size?: Size;
  /** A dashed frame, for a panel that is empty (as opposed to a list that is filtered to nothing). */
  framed?: boolean;
  /** `positive` for "all clear" (a green icon), `neutral` otherwise. */
  tone?: 'neutral' | 'positive';
  className?: string;
}
/**
 * THE empty state of the app: an icon, a title and a subtext (and, when useful, an action). Every list, panel, page and dialog that can be empty uses this one component,
 * so empty screens look and read the same everywhere. Change how they look here.
 */
export function EmptyState({
  icon: Icon,
  title,
  subtext,
  action,
  children,
  size = 'md',
  framed,
  tone = 'neutral',
  className,
}: EmptyStateProps) {
  const s = SIZE[size];
  return (
    <div
      role="status"
      className={cx(
        'mx-auto flex w-full max-w-lg flex-col items-center justify-center text-center',
        s.box,
        framed && 'rounded-xl border border-dashed border-primary',
        className,
      )}
    >
      <span
        className={cx(
          'mb-1 grid place-items-center rounded-full',
          s.circle,
          tone === 'positive' ? 'bg-success-secondary text-fg-success-primary' : 'bg-secondary text-fg-quaternary',
        )}
      >
        <Icon className={s.icon} />
      </span>
      <p className={cx('font-semibold text-primary', s.title)}>{title}</p>
      {subtext && <p className={cx('text-tertiary', s.sub)}>{subtext}</p>}
      {children}
      {action && <div className="mt-3 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

/** A search or filter that matches nothing: same component, the search icon and the same wording everywhere. */
export const NoResults = ({
  subtext,
  size = 'md',
  className,
}: {
  subtext?: ReactNode;
  size?: Size;
  className?: string;
}) => <EmptyState icon={SearchLg} title={misc.ui.noResults} subtext={subtext} size={size} className={className} />;
