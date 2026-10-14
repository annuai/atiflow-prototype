import { useMemo, useState } from 'react';
import { LinkExternal01, Minus, Plus } from '@untitledui/icons';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { Select } from '@/components/base/select/select';
import type { RobotTelemetry, SiteLayout } from '@/core/types';
import { Card, CardTitle } from '@/components/data/Card';
import { MAP_COLORS, mapStateOf, type MapColor } from '../data/mapState';

const LEGEND: [MapColor, string][] = [['moving', 'Moving'], ['idle', 'Idle'], ['charging', 'Charging'], ['attention', 'Attention']];
const bbox = (pts: [number, number][]) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }; };

/** A small, live version of the Live Floor: the floor plan from above with every robot on it. Pick a zone to zoom to it, click a robot to open it on the Live Floor. */
export function LiveStatusCard({ site, robots, onLocate, onOpen, readOnly = false }: { site: SiteLayout | null; robots: RobotTelemetry[]; onLocate(id: string): void; onOpen(): void; /** no controls (TV mode) */ readOnly?: boolean }) {
  const [zone, setZone] = useState('all'); const [zoom, setZoom] = useState(1);
  const zones = useMemo(() => site?.zones.filter((z) => z.active) ?? [], [site]);
  const base = useMemo(() => { if (!site) return null; const z = zones.find((q) => q.id === zone); return z ? bbox(z.polygon) : site.bounds; }, [site, zones, zone]);
  const floor = useMemo(() => site && (
    <g>
      {site.floorPolygons.map((p, i) => <polygon key={i} points={p.map((q) => q.join(',')).join(' ')} fill="#f3f4f6" />)}
      {zones.map((z) => <polygon key={z.id} points={z.polygon.map((q) => q.join(',')).join(' ')} fill={z.color} fillOpacity={0.16} />)}
      {site.equipment.map((e, i) => <rect key={i} x={e.x - e.w / 2} y={e.y - e.d / 2} width={e.w} height={e.d} fill="#e2e5e9" />)}
      <path d={site.walls.map((w) => `M${w.a[0]} ${w.a[1]}L${w.b[0]} ${w.b[1]}`).join('')} stroke="#9ca3af" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" />
    </g>), [site, zones]);
  if (!site || !base) return <Card className="h-full"><CardTitle title="Live Status" /><div className="grid h-72 place-items-center rounded-xl bg-secondary text-sm text-tertiary">Loading the floor…</div></Card>;
  // The plan is long and narrow, so it is turned a quarter turn to fill the wide card (screen x = plan y, screen y = -plan x).
  const pad = 4, w = (base.maxY - base.minY + pad * 2) / zoom, h = (base.maxX - base.minX + pad * 2) / zoom, cx = (base.minX + base.maxX) / 2, cy = (base.minY + base.maxY) / 2;
  const view = `${cy - w / 2} ${-(cx + h / 2)} ${w} ${h}`;
  const r = Math.max(w, h) / 120 * 1.6;
  return (
    <Card className={readOnly ? 'flex h-full min-h-0 flex-col' : 'h-full'}>
      <CardTitle title={<span className="flex items-center gap-2">Live Status<span className="text-tertiary">-</span></span>}>
        {!readOnly && <Select size="sm" aria-label="Zone" className="w-44" selectedKey={zone} onSelectionChange={(k) => { setZone(String(k)); setZoom(1); }} items={[{ id: 'all', label: 'Whole floor' }, ...zones.map((z) => ({ id: z.id, label: z.name }))]}>{(item) => <Select.Item {...item} />}</Select>}
        {!readOnly && <ButtonUtility size="sm" color="secondary" icon={LinkExternal01} tooltip="Open Live Floor" aria-label="Open Live Floor" onPress={onOpen} />}
      </CardTitle>
      <div className={'relative overflow-hidden rounded-xl border border-secondary bg-secondary' + (readOnly ? ' min-h-0 flex-1' : '')}>
        <svg viewBox={view} className={readOnly ? 'block h-full min-h-0 w-full' : 'block h-72 w-full sm:h-80'} role="img" aria-label="Floor plan with the robots on it" preserveAspectRatio="xMidYMid meet">
          <g transform="matrix(0 -1 1 0 0 0)">
            {floor}
            {robots.map((b) => { const c = MAP_COLORS[mapStateOf(b)]; return (
              <g key={b.id} transform={`translate(${b.pose.x} ${b.pose.y})`} onClick={() => onLocate(b.id)} className="cursor-pointer">
                <title>{`${b.id} · ${b.state}`}</title><circle r={r * 1.7} fill={c} fillOpacity={0.22} /><circle r={r} fill={c} stroke="#fff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              </g>); })}
          </g>
        </svg>
        {!readOnly && <div className="absolute right-3 bottom-3 flex flex-col overflow-hidden rounded-lg border border-secondary bg-primary shadow-xs">
          <ButtonUtility size="sm" color="tertiary" icon={Plus} aria-label="Zoom in" onPress={() => setZoom((z) => Math.min(6, z * 1.4))} />
          <ButtonUtility size="sm" color="tertiary" icon={Minus} aria-label="Zoom out" onPress={() => setZoom((z) => Math.max(1, z / 1.4))} />
        </div>}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-secondary">{LEGEND.map(([k, label]) => <li key={k} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: MAP_COLORS[k] }} />{label}</li>)}</ul>
    </Card>
  );
}
