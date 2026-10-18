import { Delayed, Skeleton, SkeletonCard, SkeletonText } from '@/components/skeleton/Skeleton';
import { copy as floor } from '@/ui/copy';
import { Page, PageCard, PageCardBody, PageHeader } from '@/components/page';

/** Generic page while its code loads: the title block and one big card, in the same frame as every page, so nothing jumps when the real page arrives. */
export function PageSkeleton() {
  return (
    <Delayed>
      <Page role="status" aria-label={floor.frame.loading}>
        <PageHeader
          heading={
            <div className="flex flex-col gap-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
          }
        />
        <PageCard>
          <PageCardBody spacious>
            <SkeletonCard>
              <SkeletonText lines={3} />
            </SkeletonCard>
            <SkeletonCard className="flex-1">
              <SkeletonText lines={6} />
            </SkeletonCard>
          </PageCardBody>
        </PageCard>
      </Page>
    </Delayed>
  );
}
