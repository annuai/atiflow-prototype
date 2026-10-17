import { useMemo } from 'react';
import type { PreparedImport } from '@/features/map-import';

const toBase64 = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
/** The imported floor with the origin, the path the robot drove and every placed station, drawn from the smallest stored picture (nothing is saved yet). */
export function ImportPreview({ prepared }: { prepared: PreparedImport }) {
  const level = prepared.levels[prepared.levels.length - 1];
  // a data address, not an object URL: the picture is tiny (the smallest zoom level) and there is nothing to free
  const url = useMemo(() => (level ? `data:image/png;base64,${toBase64(level.bytes)}` : ''), [level]);
  const view = useMemo(() => {
    if (!level) return null;
    const w = level.width * level.res,
      h = level.height * level.res;
    return { x: -level.originCol * level.res, y: -level.originRow * level.res, w, h };
  }, [level]);
  if (!level || !view) return null;
  const r = Math.max(view.w, view.h) / 140; // pixel-like sizes that follow the picture
  const placed = prepared.map.stations.filter((s) => s.placed);
  return (
    <svg
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      role="img"
      aria-hidden
      className="h-56 w-full rounded-lg border border-secondary bg-primary"
    >
      {url && <image href={url} x={view.x} y={view.y} width={view.w} height={view.h} preserveAspectRatio="none" />}
      {prepared.map.path.length > 1 && (
        <polyline
          points={prepared.map.path.map(([x, y]) => `${x},${-y}`).join(' ')}
          fill="none"
          stroke="#14b8a6"
          strokeWidth={r * 0.6}
          strokeOpacity={0.8}
        />
      )}
      {placed.map((s) => (
        <circle key={s.externalId} cx={s.x} cy={-s.y} r={r * 1.4} fill="#f59e0b" stroke="#fff" strokeWidth={r * 0.4} />
      ))}
      <g stroke="#ef4444" strokeWidth={r * 0.5}>
        <line x1={-r * 2.5} y1={0} x2={r * 2.5} y2={0} />
        <line x1={0} y1={-r * 2.5} x2={0} y2={r * 2.5} />
      </g>
    </svg>
  );
}
