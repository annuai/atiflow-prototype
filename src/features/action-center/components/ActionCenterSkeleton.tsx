import { Skeleton } from '@/components/skeleton/Skeleton';
import { SkeletonRow, SkeletonStatusStrip } from '@/components/skeleton/blocks';

/** The status strip, the tabs and three call rows in grey, until the first look at the floor has arrived (an empty queue must not flash as "all clear"). */
export function ActionCenterSkeleton() {
  return (
    <div role="status" aria-label="Loading the calls" className="flex flex-col gap-4">
      <SkeletonStatusStrip titleWidth="w-52" detailWidth="w-72 max-w-full" /><Skeleton className="h-9 w-72 rounded-lg" />
      {Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} withButton />)}
    </div>
  );
}
