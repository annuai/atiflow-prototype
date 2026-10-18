import { Skeleton } from '@/components/skeleton/Skeleton';
import { Page, PageCard } from '@/components/page';

/** What the Map Editor shows while the map and its version history are loading. */
export function MapEditorSkeleton() {
  return (
    <Page>
      <PageCard>
        <div className="flex flex-col gap-3 p-4" role="status" aria-label="Loading the map">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[420px] w-full" />
        </div>
      </PageCard>
    </Page>
  );
}
