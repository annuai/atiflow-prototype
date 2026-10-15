import { Skeleton, SkeletonCard } from './Skeleton';

/** Reusable pieces of page skeletons, so every page skeleton is assembled from the same parts. */
export const SkeletonStatusStrip = ({
  titleWidth = 'w-56',
  detailWidth = 'w-40',
}: {
  titleWidth?: string;
  detailWidth?: string;
}) => (
  <SkeletonCard className="flex items-center gap-3 !p-5">
    <Skeleton className="size-6 rounded-full" />
    <div className="flex-1">
      <Skeleton className={`mb-2 h-4 ${titleWidth}`} />
      <Skeleton className={`h-3 ${detailWidth}`} />
    </div>
  </SkeletonCard>
);
/** A row of KPI cards (label, big number, small chart). `footer` adds the change line some pages have. */
export const SkeletonKpiRow = ({ count = 5, footer }: { count?: number; footer?: boolean }) => (
  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
    {Array.from({ length: count }, (_, i) => (
      <SkeletonCard key={i} className="flex flex-col gap-3 !p-4">
        <Skeleton className="h-3.5 w-24" />
        <div className="flex items-end justify-between">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
        {footer && <Skeleton className="h-3 w-28" />}
      </SkeletonCard>
    ))}
  </div>
);
/** A titled card with a block (chart / map) inside. */
export const SkeletonPanel = ({
  titleWidth = 'w-28',
  height = 'h-64',
  className,
}: {
  titleWidth?: string;
  height?: string;
  className?: string;
}) => (
  <SkeletonCard className={className}>
    <Skeleton className={`mb-4 h-5 ${titleWidth}`} />
    <Skeleton className={`${height} w-full rounded-xl`} />
  </SkeletonCard>
);
/** A list row: round icon, two lines, an optional button. */
export const SkeletonRow = ({ withButton }: { withButton?: boolean }) => (
  <SkeletonCard className="flex items-center gap-3 !p-4">
    <Skeleton className="size-10 rounded-full" />
    <div className="flex-1">
      <Skeleton className="mb-2 h-4 w-60 max-w-full" />
      <Skeleton className="mb-1.5 h-3 w-80 max-w-full" />
      <Skeleton className="h-3 w-44" />
    </div>
    {withButton && <Skeleton className="hidden h-9 w-40 rounded-lg sm:block" />}
  </SkeletonCard>
);
