import { Delayed, Skeleton, SkeletonCard, SkeletonText } from '@/components/skeleton/Skeleton';

/** Generic page while its code loads: the title block and one big card, in the same frame as every page, so nothing jumps when the real page arrives. */
export function PageSkeleton() {
  return (
    <Delayed>
      <div className="content" role="status" aria-label="Loading">
        <div className="title-block"><div className="flex flex-col gap-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-72" /></div></div>
        <div className="builder md-card"><div className="md-body flex flex-col gap-4 !px-5 !py-5 sm:!px-6"><SkeletonCard><SkeletonText lines={3} /></SkeletonCard><SkeletonCard className="flex-1"><SkeletonText lines={6} /></SkeletonCard></div></div>
      </div>
    </Delayed>
  );
}
