import { useMemo, useState } from 'react';
import { Map01, Send01, SearchLg, Stars02 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { store, useApp } from '@/core/store';
import { handle } from '@/ui/engineHandle';
import { notify } from '@/ui/toast';
import { cx } from '@/utils/cx';
import { findTargets, type LocateHit } from './locate';

/** Bottom search box of the Live Floor: type a robot or station id, pick (or press Enter) and the camera flies there and selects it. */
export function LocateBox({ legendClosed, onOpenLegend }: { legendClosed: boolean; onOpenLegend(): void }) {
  const robots = useApp((s) => s.robots), stations = useApp((s) => s.nav?.stations ?? []);
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const [active, setActive] = useState(0);
  const hits = useMemo(() => findTargets(q, robots, stations), [q, robots, stations]);
  const locate = (h: LocateHit) => {
    const s = store.getState(); setOpen(false); setQ(h.id);
    if (s.cameraMode === 'walk' || s.cameraMode === 'follow') s.setCameraMode('orbit');
    if (h.kind === 'robot') { const r = s.robots[h.id]; if (r && s.fleetId !== 'all' && r.fleetId !== s.fleetId) { s.setFleet('all'); s.setNav('live'); } handle.engine?.focusRobot(h.id); }
    else { s.selectStation(h.id); handle.engine?.focusStation(h.id); }
  };
  const go = () => { const h = hits[Math.min(active, hits.length - 1)]; if (h) locate(h); else if (q.trim()) notify.warning(`No robot or station matches “${q.trim()}”`, 'Try an id such as TRP-20487 or STA-101.', 'locate-none'); };
  return (
    <div className="cmdrow">
    <div className="float cmd" onKeyDown={(e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, hits.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      else if (e.key === 'Escape') setOpen(false);
      else if (e.key === 'Enter') { e.preventDefault(); go(); }
    }}>
      {open && hits.length > 0 && (
        <ul role="listbox" aria-label="Matches" className="absolute right-0 bottom-full left-0 z-20 mb-2 overflow-hidden rounded-xl border border-secondary bg-primary shadow-lg">
          {hits.map((h, i) => (
            <li key={h.kind + h.id} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); locate(h); }}
              className={cx('flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm', i === active && 'bg-primary_hover')}>
              <span className="font-semibold text-primary">{h.title}</span><span className="truncate text-tertiary">{h.sub}</span>
            </li>))}
        </ul>)}
      <span className="ai"><Stars02 className="size-4" /></span>
      <Input size="sm" icon={SearchLg} className="flex-1" wrapperClassName="shadow-none ring-0 bg-transparent" placeholder="Search Robots or Stations by ID" aria-label="Search Robots or Stations by ID"
        value={q} onChange={(v) => { setQ(v); setOpen(true); setActive(0); }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} />
      <Button size="sm" color="primary" iconLeading={Send01} aria-label="Locate" onPress={go} />
    </div>
    {legendClosed && <div className="float mapkey"><Button size="md" color="tertiary" iconLeading={Map01} onPress={onOpenLegend}>Map key</Button></div>}
    </div>
  );
}
