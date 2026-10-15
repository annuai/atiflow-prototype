import { Skeleton, SkeletonCard, SkeletonText } from '@/components/skeleton/Skeleton';
import { SkeletonKpiRow, SkeletonPanel, SkeletonStatusStrip } from '@/components/skeleton/blocks';

import { insights } from '../insightsCopy';

/** The report's layout in grey: verdict strip, five KPI cards, trend chart beside "what changed". */
export function ReportsSkeleton() {
  return (
    <div role="status" aria-label={insights.reports.loading} className="flex flex-col gap-5">
      <SkeletonStatusStrip titleWidth="w-64" detailWidth="w-44" />
      <SkeletonKpiRow footer />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <SkeletonPanel titleWidth="w-24" height="h-60" />
        <SkeletonCard>
          <Skeleton className="mb-4 h-5 w-32" />
          <SkeletonText lines={6} />
        </SkeletonCard>
      </div>
    </div>
  );
}
