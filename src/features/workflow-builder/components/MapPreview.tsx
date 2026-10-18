import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { StatusDot } from '@/components/data/StatusDot';
import { Map01, Minus } from '@untitledui/icons';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { locate } from '../model/tree';
import { selectFleet, selectNodes, useWorkflow, wfStore } from '../model/store';
import { stationField, useFleetScene, useFleetStations } from '../model/stations';
import { NODE_TYPES } from '../model/registry';
import { simBus } from '../sim/runner';
import type { Vec2 } from '@/core/types';
import { StationMap } from './StationMap';
import { copy } from '../copy';

const HEAD_H = 51,
  FOOT_H = 36;
const PREVIEW = '/sites/ecc/preview.png';

/**
 * The map of the open fleet (the same site and lane map as the Live Floor). Select a Station or If Logic step and click a station on the map to set it; while Simulate runs a robot drives the workflow from station to station along the lanes.
 `float`: draggable card inside the canvas. `docked`: column beside the builder while a simulation runs.
 */
export function MapPreview({
  mode,
  canvasRef,
  onClose,
}: {
  mode: 'float' | 'docked';
  canvasRef?: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const [moved, setMoved] = useState<{ x: number; y: number } | null>(null);
  const sim = useWorkflow((s) => s.sim);
  const selected = useWorkflow((s) => s.selected);
  const nodes = useWorkflow(selectNodes);
  const fleet = useWorkflow(selectFleet);
  const map = useFleetScene(fleet); // this fleet's map, the latest published version: undefined while loading, null when it has none
  const stations = useFleetStations(fleet);
  const usable = useMemo(() => new Set(stations.map((s) => s.id)), [stations]);
  const node = useMemo(() => (selected ? (locate(nodes, selected)?.node ?? null) : null), [selected, nodes]);
  const sf = stationField(node);
  const highlighted = sim.hlStation ? [sim.hlStation] : (sf?.ids ?? []);
  const running = sim.status === 'running';
  const pickable = !!sf && !running;
  const [route, setRoute] = useState<{ cur: Vec2[] | null; done: Vec2[][] }>({ cur: null, done: [] });
  const [robot, setRobot] = useState<{ p: Vec2; heading: number } | null>(null);
  useEffect(
    () =>
      simBus.on((f) => {
        if (f.type === 'robot') setRobot({ p: f.p, heading: f.heading });
        else if (f.type === 'route') setRoute({ cur: f.cur, done: f.done });
        else {
          setRoute({ cur: null, done: [] });
          setRobot(null);
        }
      }),
    [],
  );

  // drag the floating card by its header (mouse + touch)
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if (mode !== 'float' || (e.target as HTMLElement).closest('button')) return;
    const r = card.current!.getBoundingClientRect(),
      c = canvasRef!.current!.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left + c.left, dy: e.clientY - r.top + c.top };
    card.current!.classList.add('moving');
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current,
      c = canvasRef?.current;
    if (!d || !c) return;
    const cw = c.clientWidth,
      ch = c.clientHeight,
      el = card.current!;
    setMoved({
      x: Math.max(4, Math.min(e.clientX - d.dx, cw - el.offsetWidth - 4)),
      y: Math.max(4, Math.min(e.clientY - d.dy, ch - el.offsetHeight - 4)),
    });
  };
  const onUp = () => {
    drag.current = null;
    card.current?.classList.remove('moving');
  };

  const label = node ? NODE_TYPES[node.t].label : '';
  const hint = !fleet
    ? copy.map.hintChooseFleet
    : map === undefined
      ? copy.map.loading
      : map === null
        ? copy.map.hintNoMap
        : !stations.length
          ? copy.map.hintNoStations
          : pickable
            ? copy.map.hintPick(label, sf!.multi)
            : running
              ? ''
              : copy.map.hintSelect;
  return (
    <div
      ref={card}
      className={`wf-map ${mode}`}
      data-no-pan
      role="region"
      aria-label={copy.map.title}
      style={
        mode === 'float' && moved
          ? { left: moved.x, top: moved.y, right: 'auto' }
          : mode === 'docked'
            ? { width: 'clamp(260px, 28vw, 398px)' }
            : undefined
      }
    >
      <div
        className="wf-map-head"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <Map01 className="size-4 text-fg-tertiary" />
        {copy.map.title}
        {running && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-quaternary">
            <StatusDot tone="success" size="sm" />
            {copy.map.running}
          </span>
        )}
        <ButtonUtility
          className={running ? '' : 'ml-auto'}
          size="xs"
          color="tertiary"
          icon={Minus}
          tooltip={mode === 'docked' ? copy.map.stopClose : copy.map.minimize}
          onPress={onClose}
        />
      </div>
      <div className="wf-map-body" style={{ top: HEAD_H, bottom: mode === 'docked' ? FOOT_H : 0 }}>
        {map ? (
          <StationMap
            site={map.site}
            nav={map.nav}
            usable={usable}
            highlighted={highlighted}
            pickable={pickable}
            onPick={(id) => selected && wfStore.getState().pickStation(selected, id)}
            done={route.done}
            route={route.cur}
            robot={robot}
          />
        ) : (
          <div className="grid size-full place-items-center px-4 text-center text-sm text-tertiary">
            {fleet ? (map === null ? copy.map.hintNoMap : copy.map.loading) : copy.map.hintChooseFleet}
          </div>
        )}
        {hint && (
          <div
            className={
              'pointer-events-none absolute top-2 right-2 left-2 rounded-lg px-2.5 py-1.5 text-center text-xs shadow-sm ring-1 ' +
              (pickable
                ? 'bg-brand-primary font-medium text-primary ring-brand'
                : 'bg-primary/90 text-tertiary ring-secondary')
            }
            aria-live="polite"
          >
            {hint}
          </div>
        )}
      </div>
      {mode === 'docked' && (
        <div className="wf-map-foot" aria-live="polite">
          {sim.step}
        </div>
      )}
    </div>
  );
}

/** Collapsed map: a small card that opens the full map. */
export function MapMini({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="wf-mini" data-no-pan aria-label={copy.map.open} title={copy.map.open} onClick={onOpen}>
      <span className="wf-map-floor" style={{ backgroundImage: `url(${PREVIEW})` }} />
      <span className="head">
        <Map01 className="size-4 text-fg-tertiary" />
        {copy.map.title}
      </span>
    </button>
  );
}
