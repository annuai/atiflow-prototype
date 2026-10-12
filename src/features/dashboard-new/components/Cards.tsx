import type { ReactNode } from 'react';
import { cx } from '@/utils/cx';

/** White rounded block used by every part of the new dashboard (same look as the current dashboard's Card; moves into `dashboard/components` with the merge). */
export const Card = ({ className, children, tv }: { className?: string; children: ReactNode; tv?: boolean }) => <section className={cx('rounded-xl border border-secondary bg-primary shadow-xs', tv ? 'p-4' : 'p-5', className)}>{children}</section>;
export const CardTitle = ({ title, hint, children }: { title: ReactNode; hint?: ReactNode; children?: ReactNode }) => (
  <header className="mb-3 flex min-h-8 flex-wrap items-center justify-between gap-2"><div><h2 className="text-md font-semibold text-primary">{title}</h2>{hint && <p className="text-xs text-tertiary">{hint}</p>}</div>{children && <div className="flex items-center gap-2">{children}</div>}</header>
);
