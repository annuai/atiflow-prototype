import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Route, SwitchVertical01 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { Select } from '@/components/base/select/select';
import { EmptyState } from '@/components/data/EmptyState';
import { useApp } from '@/core/store';
import { useFleetDirectory } from '@/data/fleetDirectory';
import { robotsOnFloor, useRobotRecords } from '@/data/robots';
import { ROBOT_TYPES } from '@/data/robotTypes';
import { useAuth } from '@/features/auth/authStore';
import { useOperator } from '@/features/requests/model/useOperator';
import { StationMap } from '@/features/workflow-builder/components/StationMap';
import { fleetStations, stationLabel, useMapData } from '@/features/workflow-builder/model/stations';
import { notify } from '@/ui/toast';
import { RobotTile } from './components/RobotTile';
import { copy } from './copy';
import { useBookingsRunning } from './model/bridge';
import { bookingError } from './model/rules';
import { bookingsStore } from './model/store';

/**
 * Book a custom trip (operator): choose the robot to call, then the start and end station, from the lists or by tapping them on the map, and book. No material, no approval and no stops:
 * it goes straight to the fleet and shows up in History. Two pages, tablet-sized controls, like Request; the map takes the height that is left.
 */
export function BookTripPage() {
  useBookingsRunning(); const me = useOperator(); const user = useAuth((s) => s.user)!; const map = useMapData(); const all = useFleetDirectory(); const records = useRobotRecords(); const live = useApp((s) => s.robots);
  const mine = useMemo(() => all.filter((f) => me.fleets.includes(f.id)), [all, me.fleets]);
  const [fleetId, setFleetId] = useState(''); const fleet = mine.find((f) => f.id === fleetId) ?? mine[0]; const fleetLive = fleet ? fleet.liveId ?? fleet.id : '';
  const [step, setStep] = useState<1 | 2>(1); const [robot, setRobot] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const stations = useMemo(() => (fleet ? fleetStations(fleet.name, map) : []), [fleet, map]);
  // robots on the fleet's floor by type; "free now" comes from the live telemetry: no trip and enough battery to take one
  const fleetRobots = useMemo(() => Object.values(live).filter((r) => r.fleetId === fleetLive), [live, fleetLive]); const telemetry = fleetRobots.length > 0;
  const freeOf = (id: string) => fleetRobots.filter((r) => r.model === id && (!r.task || r.task.type === 'park') && r.battery >= 25 && !['error', 'offline', 'charging', 'blocked'].includes(r.state)).length;
  const types = useMemo(() => { const on = fleet ? robotsOnFloor(records, [fleetLive]).filter((r) => r.fleet?.id === fleet.id) : []; return ROBOT_TYPES.map((t) => ({ type: t, count: on.filter((r) => r.type.id === t.id).length })).filter((x) => x.count > 0); }, [records, fleet, fleetLive]);
  useEffect(() => { if (robot && !types.some((x) => x.type.id === robot)) { setRobot(''); setStep(1); } }, [types, robot]);          // the chosen robot type is gone (fleet changed): choose again
  useEffect(() => { setFrom(''); setTo(''); setStep(1); }, [fleet?.id]);
  const nameOf = (id: string) => { const s = stations.find((x) => x.id === id); return s ? stationLabel(s) : id; };
  const pickStep: 'start' | 'end' | 'done' = !from ? 'start' : !to ? 'end' : 'done';
  const pick = (id: string) => { if (!from || to) { setFrom(id); setTo(''); } else if (id !== from) setTo(id); };
  const options = stations.map((s) => ({ id: s.id, label: stationLabel(s) })); const chosen = types.find((x) => x.type.id === robot)?.type;
  const error = bookingError({ robotType: robot, from, to });
  const book = () => {
    if (!fleet || !chosen || error) return;
    const t = bookingsStore.getState().book({ username: user.username, name: user.name }, { fleet: fleet.name, fleetLive, robotType: chosen.id, robotLabel: chosen.label, from, to, fromName: nameOf(from), toName: nameOf(to) });
    if (t) { notify.success(copy.book.booked(t.tripId), copy.book.summary(chosen.label, t.fromName, t.toName), 'trip-booked'); setFrom(''); setTo(''); setStep(1); }          // ready for the next booking
  };
  return (
    <div className="content">
      <div className="title-block"><div><h1>{copy.book.title}</h1><p>{copy.book.subtitle}</p></div></div>
      <div className="builder md-card"><div className="md-body !gap-5">
        <p className="shrink-0 text-sm font-medium text-tertiary" aria-live="polite">{copy.book.stepOf(step, 2)}</p>
        {step === 1 && mine.length > 1 && <Select label={copy.book.fleet} size="md" selectedKey={fleet?.id ?? null} onSelectionChange={(k) => setFleetId(String(k))} items={mine.map((f) => ({ id: f.id, label: f.name }))} className="max-w-sm">{(item) => <Select.Item {...item} />}</Select>}
        {!fleet || !types.length
          ? <EmptyState icon={Route} title={copy.book.noRobots} subtext={copy.book.noRobotsHint} size="lg" />
          : step === 1 ? (
            <section aria-label={copy.book.robot} className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-primary">{copy.book.robotHint}</h2>
              <div role="radiogroup" aria-label={copy.book.robot} className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(200px,100%),1fr))]">
                {types.map(({ type, count }) => <RobotTile key={type.id} label={type.label} picture={type.illustration} count={copy.book.total(count)} free={telemetry ? { text: copy.book.free(freeOf(type.id)), any: freeOf(type.id) > 0 } : undefined} selected={robot === type.id} onSelect={() => { setRobot(type.id); setStep(2); }} />)}
              </div>
            </section>
          ) : (
            <section aria-label="Stations" className="grid shrink-0 gap-5 landscape:md:min-h-0 landscape:md:flex-1 landscape:md:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
              <div className="flex min-w-0 flex-col gap-4 landscape:md:min-h-0 landscape:md:overflow-y-auto">
                {chosen && (
                  <button type="button" onClick={() => setStep(1)} aria-label={`${copy.book.changeRobot}: ${chosen.label}`}
                    className="flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl border border-secondary bg-primary p-2 pr-4 text-left outline-focus-ring transition hover:bg-primary_hover focus-visible:outline-2">
                    <span className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary p-1"><img src={chosen.illustration} alt="" className="size-full object-contain" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-md font-semibold text-primary">{chosen.label}</span><span className="block text-sm text-tertiary">{copy.book.changeRobotHint}</span></span>
                    <ChevronRight className="size-5 shrink-0 text-fg-quaternary" aria-hidden />
                  </button>)}
                <h2 className="text-lg font-semibold text-primary">{copy.book.stationsHint}</h2>
                {!map ? <p className="text-sm text-tertiary">{copy.book.loading}</p> : !stations.length ? <EmptyState icon={Route} title={copy.book.noStations} subtext={copy.book.noStationsHint} size="md" /> : (
                  <div className="flex items-center gap-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-4">
                      <Select label={copy.book.start} placeholder={copy.book.pick} size="md" selectedKey={from || null} onSelectionChange={(k) => setFrom(String(k))} items={options}>{(item) => <Select.Item {...item} />}</Select>
                      <Select label={copy.book.end} placeholder={copy.book.pick} size="md" selectedKey={to || null} onSelectionChange={(k) => setTo(String(k))} items={options}>{(item) => <Select.Item {...item} />}</Select>
                    </div>
                    <ButtonUtility size="sm" color="secondary" icon={SwitchVertical01} tooltip={copy.book.swap} aria-label={copy.book.swap} isDisabled={!from && !to} onPress={() => { setFrom(to); setTo(from); }} className="shrink-0" />
                  </div>)}
                <p className="text-sm font-medium text-secondary" aria-live="polite">{copy.book.mapHint(pickStep)}</p>
                <div className="mt-auto flex flex-col gap-2 border-t border-secondary pt-4">
                  <Button size="xl" color="primary" isDisabled={!!error} onPress={book}>{copy.book.submit}</Button>
                  <p className="text-sm text-tertiary">{error ? error : chosen ? copy.book.summary(chosen.label, nameOf(from), nameOf(to)) : ''}</p>
                </div>
              </div>
              <div className="relative h-[56vh] min-h-[320px] overflow-hidden rounded-xl border border-secondary landscape:md:h-full landscape:md:min-h-0">
                {map && stations.length > 0 && <StationMap site={map.site} nav={map.nav} usable={new Set(stations.map((s) => s.id))} highlighted={[from, to].filter(Boolean)} pickable onPick={pick} />}
              </div>
            </section>
          )}
      </div></div>
    </div>
  );
}
