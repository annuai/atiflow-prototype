import { useMemo } from 'react';
import { draftOf, latestOf, structureSite, useMapVersions, type MapData } from '@/features/map-editor';
import { cx } from '@/utils/cx';
import { t } from '../text';

type P = [number, number];
const corners = (x: number, y: number, w: number, d: number, rot = 0): P[] => {
  const c = Math.cos(rot),
    s = Math.sin(rot);
  return (
    [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ] as P[]
  ).map(([lx, ly]) => [x + lx * c - ly * s, y + lx * s + ly * c]);
};

/** The plan of a map seen from above, drawn from what the map holds (the walls, machines and work areas that were drawn, its routes and stations), never from the lidar scan. */
function plan(data: MapData) {
  const site = structureSite({ ...data, structure: undefined }); // what was drawn on the map; the raw lidar scan is not part of the picture
  const placed = new Set(data.stations.filter((s) => !s.unplaced).map((s) => s.nodeId));
  const nodes = data.nodes.filter((n) => n.kind !== 'station' || placed.has(n.id));
  const xs: number[] = [],
    ys: number[] = [];
  const take = (x: number, y: number) => {
    xs.push(x);
    ys.push(y);
  };
  for (const w of site.walls) {
    take(w.a[0], w.a[1]);
    take(w.b[0], w.b[1]);
  }
  for (const q of site.equipment) take(q.x, q.y);
  for (const z of site.zones) for (const p of z.polygon) take(p[0], p[1]);
  for (const n of nodes) take(n.x, n.y);
  if (!xs.length) return null;
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = Math.max(2, 0.04 * Math.max(x1 - x0, y1 - y0));
  return {
    box: { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad },
    areas: site.zones,
    walls: site.walls.map((w) => `M${w.a[0]} ${w.a[1]}L${w.b[0]} ${w.b[1]}`).join(''),
    machines: site.equipment
      .map(
        (q) =>
          `M${corners(q.x, q.y, q.w, q.d, q.rot)
            .map((p) => p.join(' '))
            .join('L')}Z`,
      )
      .join(''),
    lanes: data.lanes.map((l) => `M${l.geom.map((g) => g.join(' ')).join('L')}`).join(''),
    stations: data.stations
      .filter((s) => !s.unplaced)
      .map((s) => nodes.find((n) => n.id === s.nodeId))
      .filter((n): n is NonNullable<typeof n> => !!n),
  };
}

/** The picture of an imported map: its plan from above (the editor's version: draft, else latest). */
export function ImportedThumbnail({ mapId, className }: { mapId: string; className?: string }) {
  const history = useMapVersions((s) => s.byMap[mapId]);
  const data = (draftOf(history) ?? latestOf(history))?.data;
  const p = useMemo(() => (data ? plan(data) : null), [data]);
  if (!p) return <div className={cx('bg-[#f4f7f6]', className)} />;
  const r = Math.max(p.box.w, p.box.h) / 90;
  return (
    <svg
      role="img"
      aria-label={t.maps.map}
      viewBox={`${p.box.x} ${-(p.box.y + p.box.h)} ${p.box.w} ${p.box.h}`}
      preserveAspectRatio="xMidYMid meet"
      className={cx('block bg-[#f4f7f6]', className)}
    >
      <g transform="scale(1,-1)">
        {p.areas.map((z) => (
          <polygon
            key={z.id}
            points={z.polygon.map((q) => q.join(',')).join(' ')}
            fill={z.color}
            fillOpacity={0.35}
            stroke={z.color}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={p.machines} fill="#cdd5d1" stroke="#9aa6a2" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        <path d={p.walls} fill="none" stroke="#52525b" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        <path
          d={p.lanes}
          fill="none"
          stroke="#14b8a6"
          strokeOpacity={0.6}
          strokeWidth={0.8}
          vectorEffect="non-scaling-stroke"
        />
        {p.stations.map((n) => (
          <circle key={n.id} cx={n.x} cy={n.y} r={r} fill="#f59e0b" stroke="#fff" strokeWidth={r * 0.3} />
        ))}
      </g>
    </svg>
  );
}
