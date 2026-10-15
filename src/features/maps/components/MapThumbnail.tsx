import { useMemo } from 'react';
import { Skeleton } from '@/components/skeleton/Skeleton';
import type { NavGraph, SiteLayout } from '@/core/types';
import { useMapData } from '@/features/workflow-builder/model/stations';
import { cx } from '@/utils/cx';

const pts = (p: [number, number][]) => p.map((q) => q.join(',')).join(' ');
/** The floor of the site, the same for every fleet: floor, equipment and walls. Built once per site. */
function useFloor(site: SiteLayout | null) {
  return useMemo(() => site && ({
    floor: site.floorPolygons.map((p) => pts(p)), equipment: site.equipment.map((e) => ({ x: e.x - e.w / 2, y: e.y - e.d / 2, w: e.w, h: e.d })),
    walls: site.walls.map((w) => `M${w.a[0]} ${w.a[1]}L${w.b[0]} ${w.b[1]}`).join(''),
  }), [site]);
}
/** What belongs to one fleet: the lanes it may drive, its stations and its areas. Different fleets give different thumbnails of the same floor. */
function useFleetLayer(site: SiteLayout | null, nav: NavGraph | null, fleetLive: string) {
  return useMemo(() => {
    if (!site || !nav) return null; const fleet = nav.fleets.find((f) => f.id === fleetLive);
    return {
      color: fleet?.color ?? '#14b8a6', areas: site.zones.filter((z) => z.active && (fleet?.areas ?? []).includes(z.id)),
      lanes: nav.lanes.filter((l) => l.fleets.includes(fleetLive)).map((l) => `M${l.geom.map((g) => g.join(' ')).join('L')}`).join(''),
      stations: nav.stations.filter((s) => s.fleets.includes(fleetLive)).map((s) => { const n = nav.nodes.find((q) => q.id === s.nodeId); return n ? { id: s.id, x: n.x, y: n.y, work: s.type !== 'charge' && s.type !== 'park' } : null; }).filter((s): s is { id: string; x: number; y: number; work: boolean } => !!s),
    };
  }, [site, nav, fleetLive]);
}

/**
 * A picture of a map, drawn from the real site and lane map (not a screenshot): the floor, then the lanes, areas and stations of the fleet that runs on it, in the fleet's colour.
 * The plan is long and narrow, so it is turned a quarter turn to fill a wide card; the whole plan is always shown. Size it with `className`.
 */
export function MapThumbnail({ fleetLive, className }: { fleetLive: string; className?: string }) {
  const data = useMapData(); const site = data?.site ?? null; const floor = useFloor(site); const layer = useFleetLayer(site, data?.nav ?? null, fleetLive);
  if (!site || !floor || !layer) return <Skeleton className={cx('rounded-none', className)} />;
  const { minX, maxX, minY, maxY } = site.bounds; const pad = 3; const w = maxY - minY + pad * 2, h = maxX - minX + pad * 2; const cx0 = (minX + maxX) / 2, cy0 = (minY + maxY) / 2;
  const r = Math.max(w, h) / 120;
  return (
    <svg role="img" aria-label="Map" viewBox={`${cy0 - w / 2} ${-(cx0 + h / 2)} ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className={cx('block bg-[#f4f7f6]', className)}>
      <g transform="matrix(0 -1 1 0 0 0)">
        {floor.floor.map((p, i) => <polygon key={i} points={p} fill="#ffffff" />)}
        {layer.areas.map((z) => <polygon key={z.id} points={pts(z.polygon)} fill={layer.color} fillOpacity={0.14} />)}
        {floor.equipment.map((e, i) => <rect key={i} x={e.x} y={e.y} width={e.w} height={e.h} fill="#e7eaee" />)}
        <path d={floor.walls} stroke="#a3acb8" strokeWidth={0.9} vectorEffect="non-scaling-stroke" fill="none" />
        <path d={layer.lanes} stroke={layer.color} strokeOpacity={0.55} strokeWidth={1.5} vectorEffect="non-scaling-stroke" fill="none" strokeLinejoin="round" />
        {layer.stations.map((s) => <circle key={s.id} cx={s.x} cy={s.y} r={s.work ? r * 1.15 : r * 0.7} fill={s.work ? layer.color : '#94a3b8'} stroke="#fff" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />)}
      </g>
    </svg>
  );
}
