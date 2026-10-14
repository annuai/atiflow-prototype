import { SkeletonCard, SkeletonText, Skeleton } from '@/components/skeleton/Skeleton';
import { SkeletonKpiRow, SkeletonPanel, SkeletonStatusStrip } from '@/components/skeleton/blocks';

/** The dashboard's layout in grey (status strip, five KPIs, the card rows), shown until the first snapshot of the floor arrives. */
export function DashboardSkeleton() {
  const rows = 'grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]';
  return (
    <div role="status" aria-label="Loading the dashboard" className="flex flex-col gap-5">
      <SkeletonStatusStrip /><SkeletonKpiRow />
      <div className={rows}><SkeletonCard><Skeleton className="mb-4 h-5 w-36" /><div className="flex flex-col gap-2.5">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div></SkeletonCard><SkeletonCard><Skeleton className="mb-4 h-5 w-32" /><SkeletonText lines={4} /></SkeletonCard></div>
      <div className={rows}><SkeletonPanel /><SkeletonCard><Skeleton className="mb-4 h-5 w-20" /><SkeletonText lines={5} /></SkeletonCard></div>
    </div>
  );
}
