import { useState } from 'react';
import { useApp, store } from '../core/store';
import type { RobotState } from '../core/types';
import { handle } from './engineHandle';
import { STATE_COLOR } from '../engine/stateStyle';
import { STATION_COLOR, SHARED_COLOR } from '../engine/rulesLayer';
import { InfoPanel } from './InfoPanel';
import { STATE_TONE } from './tones';
import { notify } from './toast';
import { Badge, BadgeWithDot } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { ButtonGroup, ButtonGroupItem } from '@/components/base/button-group/button-group';
import { ZoomBar } from './ZoomBar';
import { ProgressBar } from '@/components/base/progress-indicators/progress-indicators';
import { Home01, Minus, Plus, Users01 } from '@untitledui/icons';
import type { RobotTelemetry } from '../core/types';

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
    <div className="events"><b>Live events</b>{events.slice(0, 6).map((e, i) => <div className="ev" key={i}><i className="dot" style={{ background: e.level === 'critical' ? '#ef4444' : '#14b8a6' }} /><span>{e.text}</span></div>)}{!events.length && <span style={{ color: '#737373' }}>No events yet</span>}</div>
  </div>;
}

const pathLen = (r: RobotTelemetry) => (r.path ?? []).reduce((a, p, i, all) => (i ? a + Math.hypot(p.x - all[i - 1].x, p.y - all[i - 1].y) : 0), 0);

export function RobotPanel() {
  const id = useApp((s) => s.selectedId); const r = useApp((s) => (id ? s.robots[id] : null)); const nav = useApp((s) => s.nav); const fleets = useApp((s) => s.fleets);
  if (!r) return null; const fleet = fleets.find((f) => f.id === r.fleetId); const dest = nav?.stations.find((s) => s.id === r.task?.to);
  const trafficTxt = r.traffic ? (r.traffic.status === 'waiting' ? `Waiting for ${r.traffic.zoneId}` : `Inside ${r.traffic.zoneId}`) : 'Clear';
  return <InfoPanel title={r.id} onClose={() => store.getState().select(null)}
    subtitle={`${r.model === 'sherpa-tug' ? 'Sherpa Tug' : 'Sherpa XT Lite'} · ${fleet?.name ?? r.fleetId}`}
    pill={{ label: r.state, tone: STATE_TONE[r.state] }} chips={fleet ? [{ label: fleet.name, color: fleet.color }] : []}
    stats={[
      { label: 'Battery', value: r.battery + '%', bar: { pct: r.battery, tone: r.battery < 25 ? 'error' : 'success' } }, { label: 'Speed', value: r.speed.toFixed(1) + ' m/s' },
      { label: 'Task', value: r.task?.type ?? '—' }, { label: 'Destination', value: dest ? dest.id : '—' },
      { label: 'Payload', value: r.payload ? `${r.payload.kind} ×${r.payload.qty}` : 'Empty' }, { label: 'Lane', value: r.laneId ?? '—' },
      { label: 'Traffic zone', value: trafficTxt }, { label: 'At station', value: r.atStation ?? '—' },
    ]}
    alerts={(r.alerts ?? []).map((a) => ({ text: a.msg, severity: a.severity }))}
    actions={[{ label: 'Locate', onClick: () => handle.engine?.focusRobot(r.id) }, { label: 'Follow', onClick: () => store.getState().setCameraMode('follow') }]}>
    {dest && <div className="sub" style={{ margin: '0 0 8px' }}>Heading to <b>{dest.id}</b> · {dest.name}</div>}
    {r.task?.progress != null && <div className="progress"><small>Route progress</small><ProgressBar className="mt-1 h-1.5" value={Math.round((r.task.progress ?? 0) * 100)} /></div>}
  </InfoPanel>;
}

export function StationPanel() {
  const id = useApp((s) => s.selectedStationId); const nav = useApp((s) => s.nav); const robots = useApp((s) => s.robots); const fleets = useApp((s) => s.fleets); const site = useApp((s) => s.site);
  const st = nav?.stations.find((x) => x.id === id); if (!st || !nav) return null;
  const all = Object.values(robots); const docked = all.filter((r) => r.atStation === st.id);
  const incoming = all.filter((r) => r.task?.to === st.id && r.atStation !== st.id && ['moving', 'waiting', 'blocked'].includes(r.state)).sort((a, b) => pathLen(a) - pathLen(b));
  const charging = docked.some((r) => r.state === 'charging'); const status = charging ? 'Charging' : docked.length ? 'Occupied' : incoming.length ? 'Robot inbound' : 'Free';
  const zone = site?.zones.find((z) => z.id === st.zone); const owners = fleets.filter((f) => st.fleets.includes(f.id));
  return <InfoPanel title={st.id} subtitle={`${st.name} · ${st.type === 'asrs' ? 'ASRS' : st.type[0].toUpperCase() + st.type.slice(1)} station`} onClose={() => store.getState().selectStation(null)}
    pill={{ label: status, tone: charging ? 'success' : docked.length ? 'warning' : incoming.length ? 'brand' : 'gray' }} chips={owners.map((f) => ({ label: f.name, color: f.color }))}
    stats={[{ label: 'Actual name', value: st.name }, { label: 'Type', value: st.type }, { label: 'Map area', value: zone?.name ?? '—' + (owners.length > 1 ? ' (shared)' : '') },
      { label: 'Incoming bots', value: incoming.length }, { label: 'Docked now', value: docked.length ? docked.map((r) => r.id).join(', ') : '—' }, { label: 'Served by', value: owners.length > 1 ? 'Both fleets (shared)' : owners[0]?.name ?? '—' }]}
    actions={[{ label: 'Locate', onClick: () => handle.engine?.focusStation(st.id) }]}>
    <div className="list-title">Incoming bots <span style={{ color: STATION_COLOR[st.type] }}>●</span></div>
    <div className="info-list">
      {incoming.map((r) => { const d = pathLen(r); const eta = Math.round(d / 1.1); const f = fleets.find((q) => q.id === r.fleetId);
        return <button key={r.id} onClick={() => handle.engine?.focusRobot(r.id)}><i className="dot" style={{ background: STATE_COLOR[r.state] }} /><b>{r.id}</b><span style={{ color: f?.color }}>{f?.name.split(' ')[0]}</span><em>{r.state === 'waiting' ? `waiting · ${eta}s` : `~${eta}s · ${d.toFixed(0)} m`}</em></button>; })}
      {!incoming.length && <div className="empty">No robots are heading here</div>}
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
      <div className="lg-stats"><span>Traffic zones: <b>{occ}</b> occupied · <b>{wait}</b> waiting</span><span className={violations ? 'bad' : 'good'}>Rule violations: <b>{violations}</b></span></div>
    </></div>;
}
