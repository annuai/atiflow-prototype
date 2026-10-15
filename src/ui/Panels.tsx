import { useState } from 'react';
import { useApp, store } from '../core/store';
import type { RobotState } from '../core/types';
import { handle } from './engineHandle';
import { STATE_COLOR } from '../engine/stateStyle';
import { robotTypeById } from '../data/robotTypes';
import { STATION_COLOR, SHARED_COLOR } from '../engine/rulesLayer';
import { InfoPanel } from './InfoPanel';
import { STATE_TONE } from './tones';
import { notify } from './toast';
import { Badge, BadgeWithDot } from '@/components/base/badges/badges';
import { Truck01 } from '@untitledui/icons';
import { EmptyState } from '@/components/data/EmptyState';
import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { ButtonGroup, ButtonGroupItem } from '@/components/base/button-group/button-group';
import { ZoomBar } from './ZoomBar';
import { ProgressBar } from '@/components/base/progress-indicators/progress-indicators';
import { ChevronDown, ChevronRight, Home01, Users01, ChevronUp, XClose } from '@untitledui/icons';
import type { NavGraph, RobotTelemetry } from '../core/types';
import { locateTarget } from '@/features/live-floor/locate';

type Mode = 'orbit' | 'top' | 'walk' | 'follow';
export function CameraModes({ fleetOpen, onFleet }: { fleetOpen: boolean; onFleet: () => void }) {
  const m = useApp((s) => s.cameraMode);
  const change = (v: Mode) => {
    if (v === 'follow' && !store.getState().selectedId) { notify.warning('No robot selected', 'Please select a robot first to follow.', 'follow-needs-robot'); return; }   // Follow stays clickable; explain instead of disabling
    store.getState().setCameraMode(v);
  };
  return <div className="float modes">
    <ButtonGroup size="sm" aria-label="Camera mode" selectedKeys={[m]} disallowEmptySelection onSelectionChange={(k) => { const v = [...k][0] as Mode | undefined; if (v) change(v); }}>
      <ButtonGroupItem id="orbit">3D</ButtonGroupItem><ButtonGroupItem id="top">2D</ButtonGroupItem><ButtonGroupItem id="walk">Walk</ButtonGroupItem><ButtonGroupItem id="follow">Follow</ButtonGroupItem>
    </ButtonGroup>
    <Button size="sm" color="secondary" aria-label="Home (whole floor)" iconLeading={Home01} onPress={() => handle.engine?.home()}><span className="lbl">Home</span></Button>
    <Button size="sm" color={fleetOpen ? 'primary' : 'secondary'} iconLeading={Users01} aria-label="Fleet list" aria-pressed={fleetOpen} onPress={onFleet}><span className="lbl">Fleet</span></Button>
  </div>;
}

export function ZoomControl({ pct }: { pct: number }) {
  return <ZoomBar pct={pct} onOut={() => handle.engine?.zoomBy(1.25)} onIn={() => handle.engine?.zoomBy(0.8)} />;
}

const ORDER: RobotState[] = ['moving', 'waiting', 'working', 'charging', 'blocked', 'error', 'idle', 'offline', 'paused'];
export function FleetList() {
  const robots = useApp((s) => s.robots), fleetId = useApp((s) => s.fleetId), sel = useApp((s) => s.selectedId), events = useApp((s) => s.events), q = useApp((s) => s.query);
  const [f, setF] = useState<RobotState | null>(null);
  const all = Object.values(robots).filter((r) => fleetId === 'all' || r.fleetId === fleetId).filter((r) => !q || r.id.toLowerCase().includes(q.toLowerCase()));
  const counts = ORDER.map((s) => [s, all.filter((r) => r.state === s).length] as const).filter(([, n]) => n);
  const list = all.filter((r) => !f || r.state === f).sort((a, b) => a.id.localeCompare(b.id));
  return <div className="float fleet">
    <header><span>Fleet</span><Badge size="sm" color="gray">{all.length} robots</Badge></header>
    <div className="counts">{counts.map(([s, n]) => <button key={s} className={'cnt' + (f === s ? ' on' : '')} aria-pressed={f === s} onClick={() => setF(f === s ? null : s)}><BadgeWithDot size="sm" color={STATE_TONE[s]}>{n} {s}</BadgeWithDot></button>)}</div>
    <div className="rlist">{list.map((r) => <button key={r.id} className={'ritem' + (sel === r.id ? ' sel' : '')} onClick={() => handle.engine?.focusRobot(r.id)}>
      <i className="dot" style={{ background: STATE_COLOR[r.state], width: 10, height: 10 }} /><div><div className="nm">{r.id}</div><small>{r.task ? `${r.task.type} → ${r.task.to}` : r.state}</small></div><span className="bat" style={{ color: r.battery < 25 ? '#dc2626' : undefined }}>{r.battery}%</span></button>)}</div>
    <div className="events"><b>Live events</b>{events.slice(0, 6).map((e, i) => <button type="button" className="ev" key={i} title={`Show ${e.robotId} on the map`} aria-label={`${e.text}. Show ${e.robotId} on the map`} onClick={() => locateTarget(e.robotId)}><i className="dot" style={{ background: e.level === 'critical' ? '#ef4444' : '#14b8a6' }} /><span>{e.text}</span></button>)}{!events.length && <span style={{ color: '#737373' }}>No events yet</span>}</div>
  </div>;
}

const pathLen = (r: RobotTelemetry) => (r.path ?? []).reduce((a, p, i, all) => (i ? a + Math.hypot(p.x - all[i - 1].x, p.y - all[i - 1].y) : 0), 0);

/** The robot's trip (TRP-001...): click it to see where it started, the stops on the way and the destination, and which one it is driving to. */
function TripSection({ r, nav }: { r: RobotTelemetry; nav: NavGraph | null }) {
  const [open, setOpen] = useState(false); const t = r.task; if (!t) return null;
  const stops = t.stops ?? []; const leg = t.leg ?? 0; const name = (id?: string) => nav?.stations.find((x) => x.id === id)?.name ?? '';
  const rows = [...(t.origin ? [{ id: t.origin, label: 'Start', status: 'done' }] : []),
    ...stops.map((id, i) => ({ id, label: `Stop ${i + 1}`, status: i < leg ? 'done' : i === leg ? 'now' : 'next' })),
    { id: t.to ?? '', label: 'Destination', status: leg >= stops.length ? 'now' : 'next' }].filter((x) => x.id);
  const text: Record<string, string> = { done: 'done', now: 'heading here', next: 'next' };
  return <div className="trip">
    <button type="button" className="trip-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
      {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}<b>{t.id}</b><span>{t.type} · {stops.length ? `${stops.length} stop${stops.length > 1 ? 's' : ''} · ` : ''}to {t.to}</span></button>
    {open && <div className="info-list">{rows.map((x) => <button key={x.label} onClick={() => locateTarget(x.id)}><i className="dot" style={{ background: x.status === 'now' ? '#14b8a6' : x.status === 'done' ? '#94a3b8' : '#f59e0b' }} /><b>{x.id}</b><span>{x.label}{name(x.id) ? ` · ${name(x.id)}` : ''}</span><em>{text[x.status]}</em></button>)}</div>}
  </div>;
}

export function RobotPanel() {
  const id = useApp((s) => s.selectedId); const r = useApp((s) => (id ? s.robots[id] : null)); const nav = useApp((s) => s.nav); const fleets = useApp((s) => s.fleets); const open = useApp((s) => s.robotPanelOpen);
  if (!r || !open) return null; const fleet = fleets.find((f) => f.id === r.fleetId); const dest = nav?.stations.find((s) => s.id === (r.task?.next ?? r.task?.to));
  const trafficTxt = r.traffic ? (r.traffic.status === 'waiting' ? `Waiting for ${r.traffic.zoneId}` : `Inside ${r.traffic.zoneId}`) : 'Clear';
  return <InfoPanel title={r.id} onClose={() => store.getState().closeRobotPanel()}
    subtitle={`${robotTypeById(r.model).label} · ${fleet?.name ?? r.fleetId}`}
    pill={{ label: r.state, tone: STATE_TONE[r.state] }} chips={fleet ? [{ label: fleet.name, color: fleet.color }] : []}
    stats={[
      { label: 'Battery', value: r.battery + '%', bar: { pct: r.battery, tone: r.battery < 25 ? 'error' : 'success' } }, { label: 'Speed', value: r.speed.toFixed(1) + ' m/s' },
      { label: 'Trip', value: r.task?.id ?? '—' }, { label: 'Destination', value: r.task?.to ?? '—' },
      { label: 'Payload', value: r.payload ? `${r.payload.kind} ×${r.payload.qty}` : 'Empty' }, { label: 'Lane', value: r.laneId ?? '—' },
      { label: 'Traffic zone', value: trafficTxt }, { label: 'At station', value: r.atStation ?? '—' },
    ]}
    alerts={(r.alerts ?? []).map((a) => ({ text: a.msg, severity: a.severity }))}
    actions={[{ label: 'Locate', onClick: () => handle.engine?.focusRobot(r.id) }, { label: 'Follow', onClick: () => store.getState().setCameraMode('follow') }]}>
    {dest && <div className="sub" style={{ margin: '0 0 8px' }}>Heading to <b>{dest.id}</b> · {dest.name}</div>}
    <TripSection key={r.task?.id} r={r} nav={nav} />
    {r.task?.progress != null && <div className="progress"><small>Trip progress</small><ProgressBar className="mt-1 h-1.5" value={Math.round((r.task.progress ?? 0) * 100)} /></div>}
  </InfoPanel>;
}

/** The robot window shrunk to a small floating chip (the big one was closed): the robot stays selected and, in Follow mode, followed. Open it again, or stop (deselect, which also ends Follow). */
export function RobotMini() {
  const id = useApp((s) => s.selectedId); const r = useApp((s) => (id ? s.robots[id] : null)); const open = useApp((s) => s.robotPanelOpen); const following = useApp((s) => s.cameraMode === 'follow');
  if (!r || open) return null;
  return (
    <div className="float rmini" role="group" aria-label={`${r.id} (window minimised)`}>
      <i className="dot" style={{ background: STATE_COLOR[r.state], width: 10, height: 10 }} />
      <button className="rmini-open" onClick={() => store.getState().openRobotPanel()} aria-label={`Open ${r.id}`}><b>{r.id}</b><small>{following ? 'Following · ' : ''}{r.state} · {r.battery}%</small></button>
      <ButtonUtility size="xs" color="tertiary" icon={ChevronUp} tooltip="Open the robot window" aria-label="Open the robot window" onPress={() => store.getState().openRobotPanel()} />
      <ButtonUtility size="xs" color="tertiary" icon={XClose} tooltip={following ? 'Stop following' : 'Deselect'} aria-label={following ? 'Stop following' : 'Deselect'} onPress={() => store.getState().select(null)} />
    </div>
  );
}

const STATION_KIND: Record<string, string> = { asrs: 'ASRS station', park: 'Parking spot', charge: 'Charging station' };
export function StationPanel() {
  const id = useApp((s) => s.selectedStationId); const nav = useApp((s) => s.nav); const robots = useApp((s) => s.robots); const fleets = useApp((s) => s.fleets); const site = useApp((s) => s.site);
  const st = nav?.stations.find((x) => x.id === id); if (!st || !nav) return null;
  const all = Object.values(robots); const docked = all.filter((r) => r.atStation === st.id);
  const incoming = all.filter((r) => (r.task?.next ?? r.task?.to) === st.id && r.atStation !== st.id && ['moving', 'waiting', 'blocked'].includes(r.state)).sort((a, b) => pathLen(a) - pathLen(b));
  const charging = docked.some((r) => r.state === 'charging'); const status = charging ? 'Charging' : docked.length ? 'Occupied' : incoming.length ? 'Robot inbound' : 'Free';
  const zone = site?.zones.find((z) => z.id === st.zone); const owners = fleets.filter((f) => st.fleets.includes(f.id));
  return <InfoPanel title={st.id} subtitle={`${st.name} · ${STATION_KIND[st.type] ?? st.type[0].toUpperCase() + st.type.slice(1) + ' station'}`} onClose={() => store.getState().selectStation(null)}
    pill={{ label: status, tone: charging ? 'success' : docked.length ? 'warning' : incoming.length ? 'brand' : 'gray' }} chips={owners.map((f) => ({ label: f.name, color: f.color }))}
    stats={[{ label: 'Actual name', value: st.name }, { label: 'Type', value: st.type }, { label: 'Map area', value: zone?.name ?? '—' + (owners.length > 1 ? ' (shared)' : '') },
      { label: 'Incoming bots', value: incoming.length }, { label: 'Docked now', value: docked.length ? docked.map((r) => r.id).join(', ') : '—' }, { label: 'Served by', value: owners.length > 1 ? 'Both fleets (shared)' : owners[0]?.name ?? '—' }]}
    actions={[{ label: 'Locate', onClick: () => handle.engine?.focusStation(st.id) }]}>
    <div className="list-title">Incoming bots <span style={{ color: STATION_COLOR[st.type] }}>●</span></div>
    <div className="info-list">
      {incoming.map((r) => { const d = pathLen(r); const eta = Math.round(d / 1.1); const f = fleets.find((q) => q.id === r.fleetId);
        return <button key={r.id} onClick={() => handle.engine?.focusRobot(r.id)}><i className="dot" style={{ background: STATE_COLOR[r.state] }} /><b>{r.id}</b><span style={{ color: f?.color }}>{f?.name.split(' ')[0]}</span><em>{r.state === 'waiting' ? `waiting · ${eta}s` : `~${eta}s · ${d.toFixed(0)} m`}</em></button>; })}
      {!incoming.length && <EmptyState icon={Truck01} title="No robots are heading here" subtext="Robots on their way will show here." size="sm" />}
    </div>
  </InfoPanel>;
}

/** The map key. Open or closed is owned by the page (the footer bar shows a "Map key" button while it is closed). */
export function MapLegend({ onClose }: { onClose(): void }) {
  const violations = useApp((s) => s.violations); const traffic = useApp((s) => s.traffic); const fleets = useApp((s) => s.fleets);
  const zs = Object.values(traffic); const occ = zs.filter((z) => z.occupants.length).length, wait = zs.reduce((a, z) => a + z.waiting.length, 0);
  return <div className="float legend"><button className="lg-head" onClick={onClose} aria-label="Close map key">Map key <span>–</span></button>
    <>
      {fleets.map((f) => <div className="lg" key={f.id}><i className="lane" style={{ background: f.color }} />{f.name} lanes <small>→ one way</small></div>)}
      <div className="lg"><i className="lane" style={{ background: SHARED_COLOR }} />Shared map area <small>both fleets</small></div>
      <div className="lg"><i className="sq tz" />Traffic zone <small>wait if occupied</small></div>
      <div className="lg"><i className="sq fz" />Forbidden zone <small>never entered</small></div>
      <div className="lg"><i className="pin" />Station <small>STA-1xx</small></div>
      <div className="lg"><i className="pin" style={{ borderTopColor: STATION_COLOR.park }} />Parking <small>PARK-001</small></div>
      <div className="lg"><i className="pin" style={{ borderTopColor: STATION_COLOR.charge }} />Charging <small>CHARGE-001</small></div>
      <div className="lg-stats"><span>Traffic zones: <b>{occ}</b> occupied · <b>{wait}</b> waiting</span><span className={violations ? 'bad' : 'good'}>Rule violations: <b>{violations}</b></span></div>
    </></div>;
}
