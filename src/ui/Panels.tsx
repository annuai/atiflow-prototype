import { formatNumber } from '@/i18n';
import { useState } from 'react';
import { useApp, store } from '../core/store';
import type { RobotState } from '../core/types';
import { handle } from './engineHandle';
import { STATE_COLOR } from '../engine/stateStyle';
import { robotTypeById } from '../data/robotTypes';
import { InfoPanel } from './InfoPanel';
import { STATE_TONE } from './tones';
import { notify } from './toast';
import { Badge, BadgeWithDot } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { ButtonGroup, ButtonGroupItem } from '@/components/base/button-group/button-group';
import { ZoomBar } from './ZoomBar';
import { ProgressBar } from '@/components/base/progress-indicators/progress-indicators';
import { AlertOctagon, ChevronDown, ChevronRight, Home01, ChevronUp, XClose } from '@untitledui/icons';
import type { NavGraph, RobotTelemetry } from '../core/types';
import { locateTarget } from './locate';
import { RelocalizeDialog } from './RelocalizeDialog';
import { SendToChargerDialog } from './SendToChargerDialog';
import { EmergencyStopDialog } from './StopDialogs';
import { copy } from './copy';

/** Looks up a translated name for an id the data may extend; unknown ids show as they are. */
const tx = (m: Record<string, string>, k: string) => m[k] ?? k;

type Mode = 'orbit' | 'top' | 'walk' | 'follow';
export function CameraModes() {
  const m = useApp((s) => s.cameraMode);
  const change = (v: Mode) => {
    if (v === 'follow' && !store.getState().selectedId) {
      notify.warning(copy.camera.noRobotTitle, copy.camera.noRobotText, 'follow-needs-robot');
      return;
    } // Follow stays clickable; explain instead of disabling
    store.getState().setCameraMode(v);
  };
  return (
    <div className="float modes">
      <ButtonGroup
        size="sm"
        aria-label={copy.camera.label}
        selectedKeys={[m]}
        disallowEmptySelection
        onSelectionChange={(k) => {
          const v = [...k][0] as Mode | undefined;
          if (v) change(v);
        }}
      >
        <ButtonGroupItem id="orbit">{copy.camera.orbit}</ButtonGroupItem>
        <ButtonGroupItem id="top">{copy.camera.top}</ButtonGroupItem>
        <ButtonGroupItem id="walk">{copy.camera.walk}</ButtonGroupItem>
        <ButtonGroupItem id="follow">{copy.camera.follow}</ButtonGroupItem>
      </ButtonGroup>
      <Button
        size="sm"
        color="secondary"
        aria-label={copy.camera.homeAria}
        iconLeading={Home01}
        onPress={() => handle.engine?.home()}
      >
        <span className="lbl">{copy.camera.home}</span>
      </Button>
    </div>
  );
}

export function ZoomControl({ pct }: { pct: number }) {
  return <ZoomBar pct={pct} onOut={() => handle.engine?.zoomBy(1.25)} onIn={() => handle.engine?.zoomBy(0.8)} />;
}

const ORDER: RobotState[] = [
  'moving',
  'waiting',
  'working',
  'charging',
  'blocked',
  'error',
  'idle',
  'offline',
  'paused',
];
/** The robot list and live events: one line (title and count) that opens and closes the panel; the Fleet button of the camera bar is gone. */
export function FleetList({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const robots = useApp((s) => s.robots),
    fleetId = useApp((s) => s.fleetId),
    sel = useApp((s) => s.selectedId),
    events = useApp((s) => s.events),
    q = useApp((s) => s.query);
  const [f, setF] = useState<RobotState | null>(null);
  const all = Object.values(robots)
    .filter((r) => fleetId === 'all' || r.fleetId === fleetId)
    .filter((r) => !q || r.id.toLowerCase().includes(q.toLowerCase()));
  const counts = ORDER.map((s) => [s, all.filter((r) => r.state === s).length] as const).filter(([, n]) => n);
  const list = all.filter((r) => !f || r.state === f).sort((a, b) => a.id.localeCompare(b.id));
  return (
    <div className={'float fleet' + (open ? '' : ' collapsed')}>
      <button type="button" className="fleet-head" aria-expanded={open} onClick={onToggle}>
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <span>{copy.fleetList.title}</span>
        <Badge size="sm" color="gray">
          {copy.fleetList.robots(all.length)}
        </Badge>
      </button>
      {open && (
        <>
          <div className="counts">
            {counts.map(([s, n]) => (
              <button
                key={s}
                className={'cnt' + (f === s ? ' on' : '')}
                aria-pressed={f === s}
                onClick={() => setF(f === s ? null : s)}
              >
                <BadgeWithDot size="sm" color={STATE_TONE[s]}>
                  {copy.fleetList.count(n, copy.states[s])}
                </BadgeWithDot>
              </button>
            ))}
          </div>
          <div className="rlist">
            {list.map((r) => (
              <button
                key={r.id}
                className={'ritem' + (sel === r.id ? ' sel' : '')}
                onClick={() => handle.engine?.focusRobot(r.id)}
              >
                <i className="dot" style={{ background: STATE_COLOR[r.state], width: 10, height: 10 }} />
                <div>
                  <div className="nm">{r.id}</div>
                  <small>{r.task ? `${tx(copy.taskTypes, r.task.type)} → ${r.task.to}` : copy.states[r.state]}</small>
                </div>
                <span className="bat" style={{ color: r.battery < 25 ? '#dc2626' : undefined }}>
                  {r.battery}%
                </span>
              </button>
            ))}
          </div>
          <div className="events">
            <b>{copy.fleetList.events}</b>
            {events.slice(0, 6).map((e, i) => (
              <button
                type="button"
                className="ev"
                key={i}
                title={copy.fleetList.showOnMap(e.robotId)}
                aria-label={copy.fleetList.showOnMapAria(e.text, e.robotId)}
                onClick={() => locateTarget(e.robotId)}
              >
                <i className="dot" style={{ background: e.level === 'critical' ? '#ef4444' : '#14b8a6' }} />
                <span>{e.text}</span>
              </button>
            ))}
            {!events.length && <span style={{ color: '#737373' }}>{copy.fleetList.noEvents}</span>}
          </div>
        </>
      )}
    </div>
  );
}

/** The robot's trip (TRP-001...): click it to see where it started, the stops on the way and the destination, and which one it is driving to. */
function TripSection({ r, nav }: { r: RobotTelemetry; nav: NavGraph | null }) {
  const [open, setOpen] = useState(false);
  const t = r.task;
  if (!t) return null;
  const stops = t.stops ?? [];
  const leg = t.leg ?? 0;
  const name = (id?: string) => nav?.stations.find((x) => x.id === id)?.name ?? '';
  const rows = [
    ...(t.origin ? [{ id: t.origin, label: copy.trip.start, status: 'done' }] : []),
    ...stops.map((id, i) => ({
      id,
      label: copy.trip.stop(i + 1),
      status: i < leg ? 'done' : i === leg ? 'now' : 'next',
    })),
    { id: t.to ?? '', label: copy.trip.destination, status: leg >= stops.length ? 'now' : 'next' },
  ].filter((x) => x.id);
  const text: Record<string, string> = { done: copy.trip.done, now: copy.trip.now, next: copy.trip.next };
  return (
    <div className="trip">
      <button type="button" className="trip-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <b>{t.id}</b>
        <span>{copy.trip.summary(tx(copy.taskTypes, t.type), stops.length, t.to ?? '')}</span>
      </button>
      {open && (
        <div className="info-list">
          {rows.map((x) => (
            <button key={x.label} onClick={() => locateTarget(x.id)}>
              <i
                className="dot"
                style={{ background: x.status === 'now' ? '#14b8a6' : x.status === 'done' ? '#94a3b8' : '#f59e0b' }}
              />
              <b>{x.id}</b>
              <span>
                {x.label}
                {name(x.id) ? ` · ${name(x.id)}` : ''}
              </span>
              <em>{text[x.status]}</em>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The last action of the robot window: Emergency stop (red), or Release stop while the robot is stopped. Nothing for an offline robot. */
function stopAction(r: RobotTelemetry, ask: () => void) {
  if (r.state === 'offline') return [];
  if (r.state === 'paused')
    return [
      {
        label: copy.estop.releaseButton,
        onClick: () => {
          if (handle.releaseStop?.(r.id)?.ok) notify.success(copy.estop.releasedDone(r.id), undefined, 'estop');
        },
      },
    ];
  return [{ label: copy.estop.robotButton, destructive: true, icon: AlertOctagon, onClick: ask }];
}

export function RobotPanel() {
  const id = useApp((s) => s.selectedId);
  const r = useApp((s) => (id ? s.robots[id] : null));
  const nav = useApp((s) => s.nav);
  const fleets = useApp((s) => s.fleets);
  const open = useApp((s) => s.robotPanelOpen);
  const [charger, setCharger] = useState(false);
  const [relocalize, setRelocalize] = useState(false);
  const [estop, setEstop] = useState(false);
  if (!r || !open) return null;
  const fleet = fleets.find((f) => f.id === r.fleetId);
  const dest = nav?.stations.find((s) => s.id === (r.task?.next ?? r.task?.to));
  const trafficTxt = r.traffic
    ? r.traffic.status === 'waiting'
      ? copy.robotPanel.waitingFor(r.traffic.zoneId)
      : copy.robotPanel.inside(r.traffic.zoneId)
    : copy.robotPanel.clear;
  return (
    <InfoPanel
      title={r.id}
      onClose={() => store.getState().closeRobotPanel()}
      subtitle={`${robotTypeById(r.model).label} · ${fleet?.name ?? r.fleetId}`}
      pill={{ label: copy.states[r.state], tone: STATE_TONE[r.state] }}
      chips={fleet ? [{ label: fleet.name, color: fleet.color }] : []}
      stats={[
        {
          label: copy.robotPanel.battery,
          value: r.battery + '%',
          bar: { pct: r.battery, tone: r.battery < 25 ? 'error' : 'success' },
        },
        { label: copy.robotPanel.speed, value: `${formatNumber(r.speed, 1)}\u00a0m/s` },
        { label: copy.robotPanel.trip, value: r.task?.id ?? '—' },
        { label: copy.robotPanel.destination, value: r.task?.to ?? '—' },
        {
          label: copy.robotPanel.payload,
          value: r.payload ? `${r.payload.kind} ×${r.payload.qty}` : copy.robotPanel.empty,
        },
        { label: copy.robotPanel.lane, value: r.laneId ?? '—' },
        { label: copy.robotPanel.trafficZone, value: trafficTxt },
        { label: copy.robotPanel.atStation, value: r.atStation ?? '—' },
      ]}
      alerts={(r.alerts ?? []).map((a) => ({ text: a.msg, severity: a.severity }))}
      actions={[
        { label: copy.robotPanel.locate, onClick: () => handle.engine?.focusRobot(r.id) },
        { label: copy.robotPanel.follow, onClick: () => store.getState().setCameraMode('follow') },
        ...(r.state === 'charging' || r.state === 'offline'
          ? []
          : [{ label: copy.charger.button, onClick: () => setCharger(true) }]),
        ...(r.state === 'offline' ? [] : [{ label: copy.relocalize.button, onClick: () => setRelocalize(true) }]),
        ...stopAction(r, () => setEstop(true)),
      ]}
    >
      <SendToChargerDialog robotId={charger ? r.id : null} onClose={() => setCharger(false)} />
      <RelocalizeDialog robotId={relocalize ? r.id : null} onClose={() => setRelocalize(false)} />
      <EmergencyStopDialog robotId={estop ? r.id : null} onClose={() => setEstop(false)} />
      {dest && (
        <div className="sub" style={{ margin: '0 0 8px' }}>
          {copy.robotPanel.headingTo} <b>{dest.id}</b> · {dest.name}
        </div>
      )}
      <TripSection key={r.task?.id} r={r} nav={nav} />
      {r.task?.progress != null && (
        <div className="progress">
          <small>{copy.robotPanel.tripProgress}</small>
          <ProgressBar className="mt-1 h-1.5" value={Math.round((r.task.progress ?? 0) * 100)} />
        </div>
      )}
    </InfoPanel>
  );
}

/** The robot window shrunk to a small floating chip (the big one was closed): the robot stays selected and, in Follow mode, followed. Open it again, or stop (deselect, which also ends Follow). */
export function RobotMini() {
  const id = useApp((s) => s.selectedId);
  const r = useApp((s) => (id ? s.robots[id] : null));
  const open = useApp((s) => s.robotPanelOpen);
  const following = useApp((s) => s.cameraMode === 'follow');
  if (!r || open) return null;
  return (
    <div className="float rmini" role="group" aria-label={copy.mini.minimised(r.id)}>
      <i className="dot" style={{ background: STATE_COLOR[r.state], width: 10, height: 10 }} />
      <button
        className="rmini-open"
        onClick={() => store.getState().openRobotPanel()}
        aria-label={copy.mini.open(r.id)}
      >
        <b>{r.id}</b>
        <small>
          {following ? `${copy.mini.following} · ` : ''}
          {copy.states[r.state]} · {r.battery}%
        </small>
      </button>
      <ButtonUtility
        size="xs"
        color="tertiary"
        icon={ChevronUp}
        tooltip={copy.mini.openWindow}
        aria-label={copy.mini.openWindow}
        onPress={() => store.getState().openRobotPanel()}
      />
      <ButtonUtility
        size="xs"
        color="tertiary"
        icon={XClose}
        tooltip={following ? copy.mini.stopFollowing : copy.mini.deselect}
        aria-label={following ? copy.mini.stopFollowing : copy.mini.deselect}
        onPress={() => store.getState().select(null)}
      />
    </div>
  );
}
