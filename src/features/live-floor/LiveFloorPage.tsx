import { useEffect, useRef, useState } from 'react';
import { services } from '@/services';
import { Link, useLocation } from 'react-router-dom';
import { store, useApp } from '@/core/store';
import { Engine } from '@/engine/Engine';
import { loadRobotModels } from '@/engine/robotMesh';
import { myPrefsNow } from '@/features/preferences';
import { handle } from '@/ui/engineHandle';
import { CameraModes, ZoomControl, FleetList, RobotPanel, RobotMini, StationPanel, MapLegend } from '@/ui/Panels';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { useLoadPhase } from '@/components/skeleton/Skeleton';
import { LiveFloorSkeleton } from './LiveFloorSkeleton';
import { FleetSelect, useAccess, useVisibleFleets } from '@/features/auth';
import { fleetPath } from '@/features/fleets';
import { fleetDirectory } from '@/data/fleetDirectory';
import { WalkPad } from '@/ui/WalkPad';
import { useCoarse } from '@/ui/useCoarse';
import { XClose } from '@untitledui/icons';
import { LocateBox } from './LocateBox';
import { feed } from './liveFeed';
import { chooseFleet, visibleFleetIds } from './defaultFleet';
import { showFor } from './world/scenes';
import { locateTarget, takePendingLocate } from '@/ui/locate';
import { copy } from '@/ui/copy';

/** Supervisor home: the 3D live floor. Content only; chrome comes from AppShell. */
export function LiveFloorPage() {
  const { state: routeState, search } = useLocation(); // the Dashboard can send us here to locate a robot or station; search sends `?focus=robot:AMR-003`
  const holder = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, yaw: 0, zoomPct: 100 });
  const [ready, setReady] = useState(false);
  const [fleetOpen, setFleetOpen] = useState(() => window.innerWidth > 1100);
  const manyFleets = useVisibleFleets().length > 1;
  const fleetId = useApp((s) => s.fleetId),
    mode = useApp((s) => s.cameraMode),
    site = useApp((s) => s.site),
    zoneId = useApp((s) => s.activeZoneId),
    q = useApp((s) => s.query);
  useEffect(() => {
    let dead = false;
    const eng = new Engine(holder.current!);
    handle.engine = eng;
    eng.onView = setView;
    const offReset = feed.onReset(() => eng.clearRobots());
    const release = feed.acquire();
    let live = false;
    const off = feed.onBatch((b) => {
      if (live) eng.updateRobots(b);
    });
    Promise.all([feed.ready(), loadRobotModels()]).then(([{ world }]) => {
      if (dead) return;
      live = true;
      // there is no "all fleets" view: the Live Floor shows one fleet (the chosen one, my own choice, or the first on the floor)
      const fleet = chooseFleet({
        current: store.getState().fleetId,
        visible: visibleFleetIds(),
        running: Object.keys(world.runs),
        preferred: myPrefsNow().defaultFleet,
      });
      if (fleet) store.getState().setFleet(fleet);
      showFor(eng, world, fleet ?? '');
      setReady(true);
      eng.updateRobots(Object.values(store.getState().robots)); // robots already on the floor (coming from the Dashboard or the Action Center) show at once: Locate needs their meshes
      const target = (routeState as { locate?: string } | null)?.locate;
      if (target) locateTarget(target);
    });
    return () => {
      dead = true;
      off();
      offReset();
      release();
      eng.dispose();
      handle.engine = null;
      store.setState({
        selectedId: null,
        selectedStationId: null,
        activeZoneId: null,
        cameraMode: 'orbit',
        navSel: 'live',
        fleetId: 'all',
        query: '',
      });
    }; // clean slate for the next visit
  }, []);
  useEffect(() => {
    // `?focus=robot:AMR-003` | `station:STA-113` | `zone:<id>` | `fleet:<id>`: a shareable address that flies the camera there once the scene is ready
    const f = new URLSearchParams(search).get('focus');
    if (!ready || !f) return;
    const [kind, ...rest] = f.split(':');
    const id = decodeURIComponent(rest.join(':'));
    if (kind === 'robot' || kind === 'station') locateTarget(id);
    else if (kind === 'zone') handle.engine?.focusZone(id);
    else if (kind === 'fleet') {
      store.getState().setFleet(id);
      store.getState().setNav(`fleet:${id}`);
    }
  }, [ready, search]);
  useEffect(() => {
    handle.engine?.applyFilter(fleetId, q);
  }, [fleetId, q]);
  // every fleet has its own map: choosing a fleet shows that map's scene (loaded the first time, kept after), choosing all fleets shows every map
  useEffect(() => {
    const w = feed.world();
    if (!ready || !w || !handle.engine) return;
    const fleet = chooseFleet({
      current: fleetId,
      visible: visibleFleetIds(),
      running: Object.keys(w.runs),
      preferred: myPrefsNow().defaultFleet,
    });
    if (fleet && fleet !== fleetId) return void store.getState().setFleet(fleet); // the chosen fleet is gone (a different person signed in): this effect runs again with the right one
    showFor(handle.engine, w, fleetId);
    const t = takePendingLocate(); // a locate that was waiting for this scene
    if (t) locateTarget(t);
  }, [ready, fleetId]);
  const sel = useApp((s) => s.selectedId);
  const robotPanelOpen = useApp((s) => s.robotPanelOpen);
  const selStation = useApp((s) => s.selectedStationId);
  useEffect(() => {
    const f = () => handle.engine?.setInset(fleetOpen && window.innerWidth > 720 ? 300 : 0);
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, [fleetOpen, ready]);
  const [legendOpen, setLegendOpen] = useState(() => services().device.get('atiflow.legendOpen') !== '0'); // map key: open by default, remembered once closed
  const setLegend = (o: boolean) => {
    setLegendOpen(o);
    services().device.set('atiflow.legendOpen', o ? '1' : '0');
  };
  const coarse = useCoarse();
  const loadPhase = useLoadPhase(!ready);
  const zone = site?.zones.find((z) => z.id === zoneId);
  // a fleet that is not on the floor (no map, map not published, nothing to drive on) is explained, never an empty scene
  const idle = ready ? feed.world()?.idle.find((i) => i.fleetId === fleetId) : undefined;
  const canConfigure = useAccess().can('configurator.fleets');
  return (
    <>
      <div className="content">
        <div className="title-block">
          <div>
            <h1>{copy.page.title}</h1>
            <p>{copy.page.subtitle}</p>
          </div>
          {/* Header action slot (top-right of the title block, same row as "Live Floor"). Empty on purpose: Replay + Dispatch Task were removed. See CLAUDE.md section 13. */}
          <div className="actions" />
        </div>
        <div className="builder">
          <div className="bh">
            <span className="ic">▦</span>
            <h2>{copy.page.liveView}</h2>
            <div style={{ flex: 1 }} />
            {manyFleets && (
              <>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{copy.page.fleetLabel}</span>
                <FleetSelect
                  includeAll={false}
                  className="fleet-select"
                  value={fleetId}
                  onChange={(id) => store.getState().setFleet(id)}
                />
              </>
            )}
          </div>
          <div className={'canvas' + ((sel && robotPanelOpen) || selStation ? ' has-sel' : '')}>
            <div className="gl" ref={holder} />
            {loadPhase !== 'ready' && (loadPhase === 'skeleton' ? <LiveFloorSkeleton /> : <div className="loading" />)}
            <CameraModes fleetOpen={fleetOpen} onFleet={() => setFleetOpen((o) => !o)} />
            {fleetOpen && <FleetList />}
            {idle && (
              <div className="float idle-fleet" role="status">
                <b>{copy.idleFleet.title(idle.name)}</b>
                <span>{copy.idleFleet.why[idle.why]}</span>
                {canConfigure && fleetDirectory.byName(idle.name) && (
                  <Link to={fleetPath(idle.name, 'overview')}>{copy.idleFleet.open}</Link>
                )}
              </div>
            )}
            <RobotPanel />
            <RobotMini />
            <StationPanel />
            {legendOpen && !(sel && robotPanelOpen) && !selStation && <MapLegend onClose={() => setLegend(false)} />}
            {zone && (
              <div className="float zonebar">
                <i className="dot" style={{ background: zone.color }} />
                {zone.name}
                <ButtonUtility
                  size="xs"
                  color="tertiary"
                  icon={XClose}
                  tooltip={copy.page.backToFloor}
                  onPress={() => handle.engine?.home()}
                />
              </div>
            )}
            {mode === 'walk' && (
              <div className="float hint">{coarse ? copy.walk.hintTouch : copy.walk.hintDesktop}</div>
            )}
            <WalkPad />
            <LocateBox legendClosed={!legendOpen} onOpenLegend={() => setLegend(true)} />
            <ZoomControl pct={view.zoomPct} />
          </div>
        </div>
      </div>
    </>
  );
}
