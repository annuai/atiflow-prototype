import type { Wall } from '@/core/types';
import type { Layout, Similarity } from '@/features/map-import';
import { transformLayout } from '@/features/map-import';

/** The drawing (teal) over the lidar walls (grey), flat, so the alignment can be judged while the numbers change. */
export function AlignPreview({
  lidar,
  layout,
  t,
  label,
}: {
  lidar: Wall[];
  layout: Layout;
  t: Similarity;
  label: string;
}) {
  const moved = transformLayout(layout, t).walls;
  const all = [...lidar, ...moved];
  const xs = all.flatMap((w) => [w.a[0], w.b[0]]),
    ys = all.flatMap((w) => [w.a[1], w.b[1]]);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  const pad = Math.max(x1 - x0, y1 - y0) * 0.03;
  const line = (w: Wall) => `M${w.a[0]} ${-w.a[1]}L${w.b[0]} ${-w.b[1]}`;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${x0 - pad} ${-y1 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`}
      className="h-52 w-full rounded-lg border border-secondary bg-primary"
    >
      <path
        d={lidar.map(line).join('')}
        stroke="#9ca3af"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        fill="none"
      />
      <path
        d={moved.map(line).join('')}
        stroke="#14b8a6"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        fill="none"
      />
    </svg>
  );
}
