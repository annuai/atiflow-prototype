import { GROUPS } from '../data/derive';
import type { FleetState, StateGroup } from '../data/types';
import { StackedBar } from '../charts/StackedBar';
import { copy } from '../copy';
import { Card, CardTitle } from './Cards';

/** What each fleet's robots are doing right now, as one coloured bar per fleet. */
export function FleetStatesCard({ fleets, tv, onSelect }: { fleets: FleetState[]; tv?: boolean; onSelect?: (fleetId: string, group: StateGroup) => void }) {
  const used = GROUPS.filter((g) => fleets.some((f) => f.counts[g.id]));
  return (
    <Card tv={tv}>
      <CardTitle title={copy.fleets.title} />
      <div className="flex flex-col gap-4">
        {fleets.map((f) => (
          <div key={f.id}>
            <div className="mb-1.5 flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-medium text-primary"><i className="size-2 rounded-full" style={{ background: f.color }} />{f.name}</span><span className="text-tertiary">{copy.fleets.robots(f.total)}</span></div>
            <StackedBar label={f.name} height={tv ? 20 : 14} segments={GROUPS.map((g) => ({ key: g.id, label: g.label.toLowerCase(), color: g.color, value: f.counts[g.id] }))} onSelect={onSelect && ((k) => onSelect(f.id, k as StateGroup))} />
          </div>
        ))}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-secondary">{used.map((g) => <li key={g.id} className="flex items-center gap-1.5"><i className="size-2 rounded-full" style={{ background: g.color }} />{g.label} <b className="text-primary">{fleets.reduce((a, f) => a + f.counts[g.id], 0)}</b></li>)}</ul>
    </Card>
  );
}
