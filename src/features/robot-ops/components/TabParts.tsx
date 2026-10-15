import type { ReactNode } from 'react';
import { AlertCircle } from '@untitledui/icons';
import { EmptyState } from '@/components/data/EmptyState';
import { Button } from '@/components/base/buttons/button';
import { Skeleton, useLoadPhase } from '@/components/skeleton/Skeleton';
import { copy } from '../copy';

/** Heading + supporting line at the top of a tab (same look as the Details tab). */
export function TabHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-primary">{title}</h2>
        <p className="text-sm text-tertiary">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

/** What a tab shows while its data is not there: a skeleton (after a short delay, no flash), or the error with a retry. Returns null when the data is ready. */
export function TabState({
  loading,
  error,
  failTitle,
  onRetry,
  skeleton,
}: {
  loading: boolean;
  error: string;
  failTitle: string;
  onRetry(): void;
  skeleton: ReactNode;
}) {
  const phase = useLoadPhase(loading);
  if (error && !loading)
    return (
      <EmptyState
        framed
        icon={AlertCircle}
        title={failTitle}
        subtext={error}
        action={
          <Button size="md" color="secondary" onPress={onRetry}>
            {copy.retry}
          </Button>
        }
      />
    );
  if (loading) return phase === 'skeleton' ? <>{skeleton}</> : <div aria-hidden className="min-h-40" />;
  return null;
}

export const RowSkeleton = () => <Skeleton className="h-20 w-full rounded-xl" />;
