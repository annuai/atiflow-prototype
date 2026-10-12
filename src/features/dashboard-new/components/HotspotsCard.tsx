import { fmtDuration } from '../data/derive';
import type { Hotspot } from '../data/types';
import { copy } from '../copy';
import { Card, CardTitle } from './Cards';

/** The places where robots have lost the most time waiting since the page opened (a traffic zone, or the lane a robot was held on). */
export function HotspotsCard({ hotspots, tv }: { hotspots: Hotspot[]; tv?: boolean }) {
  const max = Math.max(1, ...hotspots.map((h) => h.seconds));
  return (
    <Card tv={tv}>
      <CardTitle title={copy.hotspots.title} hint={copy.hotspots.hint} />
      {!hotspots.length ? <p className="py-6 text-center text-sm text-tertiary">{copy.hotspots.empty}</p> : (
        <ul className="flex flex-col gap-2.5">
          {hotspots.map((h) => (
            <li key={h.place}><div className="mb-1 flex items-center justify-between text-sm"><span className="font-medium text-primary">{h.label}</span><span className="text-xs text-tertiary">{h.waitingNow ? <b className="mr-2 text-fg-warning-primary">{copy.hotspots.now(h.waitingNow)}</b> : null}{fmtDuration(h.seconds)}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary"><i className="block h-full rounded-full bg-fg-brand-secondary transition-[width] duration-500" style={{ width: `${(h.seconds / max) * 100}%`, background: '#8b5cf6' }} /></div></li>
          ))}
        </ul>
      )}
    </Card>
  );
}
