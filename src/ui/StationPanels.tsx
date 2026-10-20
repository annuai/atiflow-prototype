import { formatNumber } from '@/i18n';
import { useApp, store } from '../core/store';
import { handle } from './engineHandle';
import { STATE_COLOR } from '../engine/stateStyle';
import { STATION_COLOR, SHARED_COLOR } from '../engine/rulesLayer';
import { InfoPanel } from './InfoPanel';
import { Truck01 } from '@untitledui/icons';
import { EmptyState } from '@/components/data/EmptyState';
import type { RobotTelemetry } from '../core/types';
import { copy } from './copy';

/** Looks up a translated name for an id the data may extend; unknown ids show as they are. */
const tx = (m: Record<string, string>, k: string) => m[k] ?? k;

const pathLen = (r: RobotTelemetry) =>
  (r.path ?? []).reduce((a, p, i, all) => (i ? a + Math.hypot(p.x - all[i - 1].x, p.y - all[i - 1].y) : 0), 0);

export function StationPanel() {
  const id = useApp((s) => s.selectedStationId);
  const nav = useApp((s) => s.nav);
  const robots = useApp((s) => s.robots);
  const fleets = useApp((s) => s.fleets);
  const site = useApp((s) => s.site);
  const st = nav?.stations.find((x) => x.id === id);
  if (!st || !nav) return null;
  const all = Object.values(robots);
  const docked = all.filter((r) => r.atStation === st.id);
  const incoming = all
    .filter(
      (r) =>
        (r.task?.next ?? r.task?.to) === st.id &&
        r.atStation !== st.id &&
        ['moving', 'waiting', 'blocked'].includes(r.state),
    )
    .sort((a, b) => pathLen(a) - pathLen(b));
  const charging = docked.some((r) => r.state === 'charging');
  const sp = copy.stationPanel;
  const status = charging ? sp.charging : docked.length ? sp.occupied : incoming.length ? sp.inbound : sp.free;
  const zone = site?.zones.find((z) => z.id === st.zone);
  const owners = fleets.filter((f) => st.fleets.includes(f.id));
  return (
    <InfoPanel
      title={st.id}
      subtitle={`${st.name} · ${tx(copy.stationKinds, st.type)}`}
      onClose={() => store.getState().selectStation(null)}
      pill={{
        label: status,
        tone: charging ? 'success' : docked.length ? 'warning' : incoming.length ? 'brand' : 'gray',
      }}
      chips={owners.map((f) => ({ label: f.name, color: f.color }))}
      stats={[
        { label: sp.actualName, value: st.name },
        { label: sp.type, value: tx(copy.stationTypes, st.type) },
        { label: sp.mapArea, value: zone?.name ?? '—' + (owners.length > 1 ? sp.shared : '') },
        { label: sp.incoming, value: incoming.length },
        { label: sp.docked, value: docked.length ? docked.map((r) => r.id).join(', ') : '—' },
        { label: sp.servedBy, value: owners.length > 1 ? sp.bothFleets : (owners[0]?.name ?? '—') },
      ]}
      actions={[{ label: sp.locate, onClick: () => handle.engine?.focusStation(st.id) }]}
    >
      <div className="list-title">
        {sp.incoming} <span style={{ color: STATION_COLOR[st.type] }}>●</span>
      </div>
      <div className="info-list">
        {incoming.map((r) => {
          const d = pathLen(r);
          const eta = Math.round(d / 1.1);
          const f = fleets.find((q) => q.id === r.fleetId);
          return (
            <button key={r.id} onClick={() => handle.engine?.focusRobot(r.id)}>
              <i className="dot" style={{ background: STATE_COLOR[r.state] }} />
              <b>{r.id}</b>
              <span style={{ color: f?.color }}>{f?.name.split(' ')[0]}</span>
              <em>{r.state === 'waiting' ? sp.waitingEta(eta) : sp.eta(eta, formatNumber(d, 0))}</em>
            </button>
          );
        })}
        {!incoming.length && <EmptyState icon={Truck01} title={sp.emptyTitle} subtext={sp.emptyText} size="sm" />}
      </div>
    </InfoPanel>
  );
}

/** The map key. Open or closed is owned by the page (the footer bar shows a "Map key" button while it is closed). */
export function MapLegend({ onClose }: { onClose(): void }) {
  const violations = useApp((s) => s.violations);
  const traffic = useApp((s) => s.traffic);
  const fleets = useApp((s) => s.fleets);
  const zs = Object.values(traffic);
  const occ = zs.filter((z) => z.occupants.length).length,
    wait = zs.reduce((a, z) => a + z.waiting.length, 0);
  return (
    <div className="float legend">
      <button className="lg-head" onClick={onClose} aria-label={copy.legend.close}>
        {copy.legend.title} <span>–</span>
      </button>
      <>
        {fleets.map((f) => (
          <div className="lg" key={f.id}>
            <i className="lane" style={{ background: f.color }} />
            {copy.legend.lanes(f.name)} <small>{copy.legend.oneWay}</small>
          </div>
        ))}
        <div className="lg">
          <i className="lane" style={{ background: SHARED_COLOR }} />
          {copy.legend.sharedArea} <small>{copy.legend.bothFleets}</small>
        </div>
        <div className="lg">
          <i className="sq tz" />
          {copy.legend.trafficZone} <small>{copy.legend.waitIfOccupied}</small>
        </div>
        <div className="lg">
          <i className="sq fz" />
          {copy.legend.forbiddenZone} <small>{copy.legend.neverEntered}</small>
        </div>
        <div className="lg">
          <i className="pin" />
          {copy.legend.station} <small>STA-1xx</small>
        </div>
        <div className="lg">
          <i className="pin" style={{ borderTopColor: STATION_COLOR.park }} />
          {copy.legend.parking} <small>PARK-001</small>
        </div>
        <div className="lg">
          <i className="pin" style={{ borderTopColor: STATION_COLOR.charge }} />
          {copy.legend.charging} <small>CHARGE-001</small>
        </div>
        <div className="lg-stats">
          <span>
            {copy.legend.trafficZones} <b>{occ}</b> {copy.legend.occupied} · <b>{wait}</b> {copy.legend.waiting}
          </span>
          <span className={violations ? 'bad' : 'good'}>
            {copy.legend.violations} <b>{violations}</b>
          </span>
        </div>
      </>
    </div>
  );
}
