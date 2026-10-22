import { Card, CardTitle } from '@/components/data/Card';
import { useVisibleFleets } from '@/features/auth';
import { useFleetFilter } from '@/features/fleet-filter';
import { useMapData } from '@/features/workflow-builder';
import { heatColor, heatSpots, pickPointers } from '../model/heat';
import { t } from '../text';

const POINTERS = 5;

/** The fleet whose plan is drawn: the one chosen in the fleet filter, else the first the person sees that is on the floor (null while the floor loads). */
function pickScene(map: ReturnType<typeof useMapData>, fleets: ReturnType<typeof useVisibleFleets>, fleetId: string) {
  if (!map?.scenes) return null;
  const own = fleets.find((f) => (f.liveId ?? f.id) === fleetId);
  for (const f of own ? [own, ...fleets] : fleets) {
    const sc = map.scenes.find((s) => s.fleetId === (f.liveId ?? f.id));
    if (sc) return { fleet: f.name, seed: f.id, site: sc.site, nav: sc.network };
  }
  return null;
}

/**
 * A heat map of material on the factory floor: the fleet's own plan with a glow at every work station (green: little material waiting, red: it piles up) and numbered pointers on
 * the busiest ones, listed beside the map. EXAMPLE numbers for now (see `heatSpots`). A long plan is turned a quarter turn so it fills the card, like the Dashboard's live map.
 */
export function MaterialHeatMap() {
  const map = useMapData();
  const fleets = useVisibleFleets();
  const { fleetId } = useFleetFilter();
  const scene = pickScene(map, fleets, fleetId);
  const spots = scene ? heatSpots(scene.nav, scene.seed) : []; // (cheap: a few dozen stations; the compiler memoizes it)
  if (!scene || !spots.length) return null;
  const { minX, maxX, minY, maxY } = scene.site.bounds;
  const W = maxX - minX,
    H = maxY - minY,
    turn = H > W * 1.15; // a tall plan is turned so it lies across the card
  const w = turn ? H : W,
    h = turn ? W : H;
  const pt = (x: number, y: number): [number, number] => (turn ? [y - minY, x - minX] : [x - minX, maxY - y]);
  const pct = (x: number, y: number) => {
    const [px, py] = pt(x, y);
    return { left: `${(px / w) * 100}%`, top: `${(py / h) * 100}%` };
  };
  const walls = scene.site.walls
    .map((s) => {
      const a = pt(s.a[0], s.a[1]),
        b = pt(s.b[0], s.b[1]);
      return `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
    })
    .join('');
  const radius = Math.max(w, h) * 0.03;
  const top = pickPointers(spots, POINTERS, Math.max(w, h) * 0.08);
  return (
    <Card>
      <CardTitle title={t.report.heat.title} hint={t.report.heat.hint(scene.fleet)} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div
          className="relative w-full overflow-hidden rounded-lg bg-secondary ring-1 ring-secondary"
          style={{ aspectRatio: `${w} / ${h}`, maxHeight: 460 }}
          role="img"
          aria-label={t.report.heat.aria(top.length)}
        >
          <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid meet">
            <path d={walls} fill="none" stroke="#a1a1aa" strokeWidth={0.5} strokeLinecap="round" />
            {spots.map((s) => {
              const [cx, cy] = pt(s.x, s.y);
              return (
                <circle
                  key={s.id}
                  cx={cx}
                  cy={cy}
                  r={radius * (0.6 + s.level)}
                  fill={heatColor(s.level)}
                  fillOpacity={0.1 + 0.3 * s.level}
                />
              );
            })}
            {spots.map((s) => {
              const [cx, cy] = pt(s.x, s.y);
              return <circle key={s.id} cx={cx} cy={cy} r={radius * 0.12} fill={heatColor(s.level)} />;
            })}
          </svg>
          {top.map((s, i) => (
            <span
              key={s.id}
              className="absolute flex size-6 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full rounded-bl-none bg-primary text-xs font-semibold text-primary shadow-sm ring-2"
              style={{ ...pct(s.x, s.y), ['--tw-ring-color' as string]: heatColor(s.level) }}
              title={`${s.id} · ${s.name} · ${t.units(s.units)}`}
            >
              {i + 1}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <ol className="flex flex-col gap-2">
            {top.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ background: heatColor(s.level) }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-primary" translate="no">
                    {s.name}
                  </span>
                  <span className="text-xs text-tertiary" translate="no">
                    {s.id}
                  </span>
                </span>
                <span className="text-tertiary tabular-nums">{t.units(s.units)}</span>
              </li>
            ))}
          </ol>
          <div>
            <div
              className="h-2 rounded-full"
              style={{ background: `linear-gradient(to right, ${heatColor(0)}, ${heatColor(0.5)}, ${heatColor(1)})` }}
            />
            <div className="mt-1 flex justify-between text-[11px] text-tertiary">
              <span>{t.report.heat.low}</span>
              <span>{t.report.heat.high}</span>
            </div>
          </div>
          <p className="text-xs text-quaternary">{t.report.heat.example}</p>
        </div>
      </div>
    </Card>
  );
}
