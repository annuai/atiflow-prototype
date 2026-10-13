import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { store, useApp } from '@/core/store';
import { Engine } from '@/engine/Engine';
import { loadRobotModels } from '@/engine/robotMesh';
import { AppShell } from '@/shell/AppShell';
import { handle } from '@/ui/engineHandle';
import { CameraModes, ZoomControl, FleetList, RobotPanel, StationPanel, MapLegend } from '@/ui/Panels';
import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { Input } from '@/components/base/input/input';
import { FleetSelect } from '@/components/data/FleetSelect';
import { WalkPad } from '@/ui/WalkPad'; import { useCoarse } from '@/ui/useCoarse';
import { Send01, SearchLg, Stars02, XClose } from '@untitledui/icons';
import { liveHits, useLiveNav } from './liveNav';
import { LocateBox } from './LocateBox';
import { feed } from './liveFeed';
import { locateTarget } from './locate';

/** Supervisor home: the 3D live floor. Content only; chrome comes from AppShell. */
export function LiveFloorPage() {
  const routeState = useLocation().state;                       // the Dashboard can send us here to locate a robot or station
  const holder = useRef<HTMLDivElement>(null); const [view, setView] = useState({ x: 0, y: 0, yaw: 0, zoomPct: 100 }); const [ready, setReady] = useState(false); const [fleetOpen, setFleetOpen] = useState(() => window.innerWidth > 1100);
  const fleets = useApp((s) => s.fleets), fleetId = useApp((s) => s.fleetId), mode = useApp((s) => s.cameraMode), site = useApp((s) => s.site), zoneId = useApp((s) => s.activeZoneId), q = useApp((s) => s.query);
  useEffect(() => {
    let dead = false; const eng = new Engine(holder.current!); handle.engine = eng; eng.onView = setView;
    const offReset = feed.onReset(() => eng.clearRobots()); const release = feed.acquire(); let live = false; const off = feed.onBatch((b) => { if (live) eng.updateRobots(b); });
    Promise.all([feed.ready(), loadRobotModels()]).then(([{ site: s, nav: n }]) => {
      if (dead) return; live = true; eng.load(s, n); setReady(true); eng.updateRobots(Object.values(store.getState().robots));     // robots already on the floor (coming from the Dashboard) show at once
      const target = (routeState as { locate?: string } | null)?.locate; if (target) locateTarget(target);
    });
    return () => { dead = true; off(); offReset(); release(); eng.dispose(); handle.engine = null;
      store.setState({ selectedId: null, selectedStationId: null, activeZoneId: null, cameraMode: 'orbit', navSel: 'live', fleetId: 'all', query: '' }); };   // clean slate for the next visit
  }, []);
  useEffect(() => { handle.engine?.applyFilter(fleetId, q); }, [fleetId, q]);
  const sel = useApp((s) => s.selectedId); const selStation = useApp((s) => s.selectedStationId);
  useEffect(() => { const f = () => handle.engine?.setInset(fleetOpen && window.innerWidth > 720 ? 300 : 0); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, [fleetOpen, ready]);
  const [legendOpen, setLegendOpen] = useState(() => localStorage.getItem('atiflow.legendOpen') !== '0');         // map key: open by default, remembered once closed
  const setLegend = (o: boolean) => { setLegendOpen(o); localStorage.setItem('atiflow.legendOpen', o ? '1' : '0'); };
  const coarse = useCoarse();
  const zone = site?.zones.find((z) => z.id === zoneId);
  return (
    <AppShell useNavModel={useLiveNav} getHits={liveHits} searchPlaceholder="Search robots, stations, zones…">
      <div className="content">
        <div className="title-block"><div><h1>Live Floor</h1><p>Track every robot and its activity in real time</p></div>
          {/* Header action slot (top-right of the title block, same row as "Live Floor"). Empty on purpose: Replay + Dispatch Task were removed. See CLAUDE.md section 13. */}
          <div className="actions" /></div>
        <div className="builder">
          <div className="bh"><span className="ic">▦</span><h2>Live View</h2><div style={{ flex: 1 }} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Fleet -</span>
            <FleetSelect className="fleet-select" value={fleetId} onChange={(id) => store.getState().setFleet(id)} /></div>
          <div className={'canvas' + (sel || selStation ? ' has-sel' : '')}><div className="gl" ref={holder} />{!ready && <div className="loading">Loading site…</div>}
            <CameraModes fleetOpen={fleetOpen} onFleet={() => setFleetOpen((o) => !o)} />{fleetOpen && <FleetList />}<RobotPanel /><StationPanel />{legendOpen && !sel && !selStation && <MapLegend onClose={() => setLegend(false)} />}
            {zone && <div className="float zonebar"><i className="dot" style={{ background: zone.color }} />{zone.name}<ButtonUtility size="xs" color="tertiary" icon={XClose} tooltip="Back to whole floor" onPress={() => handle.engine?.home()} /></div>}
            {mode === 'walk' && <div className="float hint">{coarse ? 'Left stick: move (push far to run) · Drag to look' : 'WASD move · Mouse look · Shift run · Esc exit'}</div>}<WalkPad />
            <LocateBox legendClosed={!legendOpen} onOpenLegend={() => setLegend(true)} />
            <ZoomControl pct={view.zoomPct} />
          </div></div>
      </div>
    </AppShell>
  );
}
