import { Skeleton } from '@/components/skeleton/Skeleton';

/** The floor while the site and the robot models load: the controls and a few plan-shaped blocks in grey, so the canvas does not pop in from nothing. */
export function LiveFloorSkeleton() {
  return (
    <div role="status" aria-label="Loading the floor" className="absolute inset-0 z-20 overflow-hidden bg-[#e6ebe9]">
      <Skeleton className="absolute left-5 top-4 h-10 w-64 rounded-lg" />
      <Skeleton className="absolute left-[8%] top-[24%] h-24 w-[34%] rounded-md" /><Skeleton className="absolute left-[8%] top-[52%] h-20 w-[28%] rounded-md" /><Skeleton className="absolute left-[46%] top-[30%] h-32 w-[22%] rounded-md" />
      <Skeleton className="absolute left-[42%] top-[68%] h-16 w-[30%] rounded-md" /><Skeleton className="absolute right-[8%] top-[22%] h-24 w-[14%] rounded-md" />
      <Skeleton className="absolute bottom-4 left-5 h-12 w-[60%] max-w-xl rounded-xl" /><Skeleton className="absolute bottom-4 right-5 h-12 w-32 rounded-xl" />
    </div>
  );
}
