import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Route, SwitchVertical01 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { Select } from '@/components/base/select/select';
import { EmptyState } from '@/components/data/EmptyState';
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
 * it goes straight to the fleet and shows up in History. Tablet-sized controls, like Request.
 */
export function BookTripPage() {
  useBookingsRunning(); const me = useOperator(); const user = useAuth((s) => s.user)!; const map = useMapData(); const all = useFleetDirectory(); const records = useRobotRecords();
  const mine = useMemo(() => all.filter((f) => me.fleets.includes(f.id)), [all, me.fleets]);
  const [fleetId, setFleetId] = useState(''); const fleet = mine.find((f) => f.id === fleetId) ?? mine[0];
  const [robot, setRobot] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const stations = useMemo(() => (fleet ? fleetStations(fleet.name, map) : []), [fleet, map]);
  const types = useMemo(() => { const on = fleet ? robotsOnFloor(records, [fleet.liveId ?? fleet.id]).filter((r) => r.fleet?.id === fleet.id) : []; return ROBOT_TYPES.map((t) => ({ type: t, count: on.filter((r) => r.type.id === t.id).length })).filter((x) => x.count > 0); }, [records, fleet]);
  useEffect(() => { if (robot && !types.some((x) => x.type.id === robot)) { setRobot(''); setStep(1); } }, [types, robot]);          // the chosen robot type is gone (fleet changed): choose again
  useEffect(() => { setFrom(''); setTo(''); setStep(1); }, [fleet?.id]);
  const nameOf = (id: string) => { const s = stations.find((x) => x.id === id); return s ? stationLabel(s) : id; };
  const [step, setStep] = useState<1 | 2>(1); const pickStep: 'start' | 'end' | 'done' = !from ? 'start' : !to ? 'end' : 'done';
  const pick = (id: string) => { if (!from || to) { setFrom(id); setTo(''); } else if (id !== from) setTo(id); };
  const options = stations.map((s) => ({ id: s.id, label: stationLabel(s) })); const chosen = types.find((x) => x.type.id === robot)?.type;
  const error = bookingError({ robotType: robot, from, to });
  const book = () => {
    if (!fleet || !chosen || error) return;
    const t = bookingsStore.getState().book({ username: user.username, name: user.name }, { fleet: fleet.name, fleetLive: fleet.liveId ?? fleet.id, robotType: chosen.id, robotLabel: chosen.label, from, to, fromName: nameOf(from), toName: nameOf(to) });
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
              <div role="radiogroup" aria-label={copy.book.robot} className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
                {types.map(({ type, count }) => <RobotTile key={type.id} label={type.label} picture={type.illustration} count={copy.book.available(count)} selected={robot === type.id} onSelect={() => { setRobot(type.id); setStep(2); }} />)}
              </div>
            </section>
          ) : (
            <section aria-label="Stations" className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" color="secondary" iconLeading={ArrowLeft} onPress={() => setStep(1)}>{copy.book.changeRobot}</Button>
                {chosen && <div className="flex items-center gap-3 rounded-xl border border-secondary bg-primary py-1.5 pr-4 pl-1.5"><span className="grid h-12 w-[72px] place-items-center rounded-lg bg-secondary p-1"><img src={chosen.illustration} alt="" className="max-h-full max-w-full object-contain" /></span><span className="text-md font-semibold text-primary">{chosen.label}</span></div>}
              </div>
              <h2 className="text-lg font-semibold text-primary">{copy.book.stationsHint}</h2>
              {!map ? <p className="text-sm text-tertiary">{copy.book.loading}</p> : !stations.length ? <EmptyState icon={Route} title={copy.book.noStations} subtext={copy.book.noStationsHint} size="md" /> : (
                <div className="grid gap-5 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
                  <div className="flex items-start gap-2 self-start">
                    <div className="flex min-w-0 flex-1 flex-col gap-4">
                      <Select label={copy.book.start} placeholder={copy.book.pick} size="md" selectedKey={from || null} onSelectionChange={(k) => setFrom(String(k))} items={options}>{(item) => <Select.Item {...item} />}</Select>
                      <Select label={copy.book.end} placeholder={copy.book.pick} size="md" selectedKey={to || null} onSelectionChange={(k) => setTo(String(k))} items={options}>{(item) => <Select.Item {...item} />}</Select>
                    </div>
                    <ButtonUtility size="sm" color="secondary" icon={SwitchVertical01} tooltip={copy.book.swap} aria-label={copy.book.swap} isDisabled={!from && !to} onPress={() => { setFrom(to); setTo(from); }} className="mt-6 shrink-0" />
                  </div>
                  <div className="flex flex-col gap-2"><p className="text-sm font-medium text-secondary">{copy.book.mapTitle}: {copy.book.mapHint(pickStep)}</p>
                    <div className="relative h-[min(52vh,420px)] min-h-[300px] overflow-hidden rounded-xl border border-secondary">
                      <StationMap site={map.site} nav={map.nav} usable={new Set(stations.map((s) => s.id))} highlighted={[from, to].filter(Boolean)} pickable onPick={pick} />
                    </div>
                  </div>
                </div>)}
              <div className="flex flex-wrap items-center gap-3 border-t border-secondary pt-4">
                <Button size="xl" color="primary" isDisabled={!!error} onPress={book}>{copy.book.submit}</Button>
                <p className="text-sm text-tertiary">{error ? error : chosen ? copy.book.summary(chosen.label, nameOf(from), nameOf(to)) : ''}</p>
              </div>
            </section>
          )}
      </div></div>
    </div>
  );
}
