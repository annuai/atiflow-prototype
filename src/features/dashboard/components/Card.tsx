import type { ReactNode } from 'react';
import { cx } from '@/utils/cx';

/** White rounded card used by every block of the dashboard. */
export const Card = ({ className, children }: { className?: string; children: ReactNode }) => <section className={cx('rounded-xl border border-secondary bg-primary p-5 shadow-xs', className)}>{children}</section>;
export const CardHeader = ({ title, children }: { title: ReactNode; children?: ReactNode }) => (
  <header className="mb-4 flex min-h-9 flex-wrap items-center justify-between gap-3"><h2 className="text-md font-semibold text-primary">{title}</h2>{children && <div className="flex items-center gap-2">{children}</div>}</header>
);
