import { useMemo, useState } from 'react';
import { useOnChange } from '@/hooks/use-synced-state';
import { ArrowLeft, Route } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { Select } from '@/components/base/select/select';
import { EmptyState } from '@/components/data/EmptyState';
import { useApp } from '@/core/store';
import { useFleetDirectory } from '@/data/fleetDirectory';
import { robotsOnFloor, useRobotRecords } from '@/data/robots';
import { ROBOT_TYPES } from '@/data/robotTypes';
import { useAuth } from '@/features/auth';
import { routeItems, useRequestsRunning, fleetLiveOf, useOperator } from '@/features/requests';
import { useWorkflow, fleetStations, stationLabel, useMapData, fleetScene } from '@/features/workflow-builder';
import { notify } from '@/ui/toast';
import { CustomCallSheet } from './CustomCallSheet';
import { RobotStep } from './RobotStep';
import { StationsStep } from './StationsStep';
import { SavedTrips } from './SavedTrips';
import { isFreeRobot } from '../model/free';
import { copy } from '../copy';
import { useBookingsRunning } from '../model/bridge';
import { bookingError } from '../model/rules';
import { bookingsStore } from '../model/store';
import { PageCardBody } from '@/components/page';

/**
 * Book Trips (a tab of the operator's Book trip page, the only content for fleets without material): saved routes first, and a custom trip: choose the robot to call, then the start and end station, from the lists or by tapping them on the map, and book. No material, no approval and no stops:
 * it goes straight to the fleet and shows up in History. Two pages, tablet-sized controls, like Request; the map takes the height that is left.
 */
export function TripsPane() {
  useBookingsRunning();
  useRequestsRunning();
  const workflows = useWorkflow((s) => s.workflows);
  const me = useOperator();
  const user = useAuth((s) => s.user)!;
  const map = useMapData();
  const all = useFleetDirectory();
  const records = useRobotRecords();
  const live = useApp((s) => s.robots);
  const mine = useMemo(() => all.filter((f) => me.fleets.includes(f.id)), [all, me.fleets]);
  const [fleetId, setFleetId] = useState('');
  const fleet = mine.find((f) => f.id === fleetId) ?? mine[0];
  const fleetLive = fleet ? (fleet.liveId ?? fleet.id) : '';
  const [mode, setMode] = useState<'routes' | 'custom'>('routes');
  const [step, setStep] = useState<1 | 2>(1);
  const [robot, setRobot] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const stations = useMemo(() => (fleet ? fleetStations(fleet.id, map) : []), [fleet, map]);
  // robots on the fleet's floor by type; "free now" comes from the live telemetry: no trip and enough battery to take one
  const fleetRobots = useMemo(() => Object.values(live).filter((r) => r.fleetId === fleetLive), [live, fleetLive]);
  const telemetry = fleetRobots.length > 0;
  const isFree = isFreeRobot;
  const freeOf = (id: string) => fleetRobots.filter((r) => r.model === id && isFree(r)).length;
  const types = useMemo(() => {
    const on = fleet ? robotsOnFloor(records, [fleetLive]).filter((r) => r.fleet?.id === fleet.id) : [];
    return ROBOT_TYPES.map((t) => ({ type: t, count: on.filter((r) => r.type.id === t.id).length })).filter(
      (x) => x.count > 0,
    );
  }, [records, fleet, fleetLive]);
  // the chosen robot type is gone (fleet changed): choose again
  if (robot && !types.some((x) => x.type.id === robot)) {
    setRobot('');
    setStep(1);
  }
  // another fleet: the stations chosen so far belong to the old one
  useOnChange(fleet?.id, () => {
    setFrom('');
    setTo('');
    setStep(1);
  });
  const nameOf = (id: string) => {
    const s = stations.find((x) => x.id === id);
    return s ? stationLabel(s) : id;
  };
  const pickStep: 'start' | 'end' | 'done' = !from ? 'start' : !to ? 'end' : 'done';
  const pick = (id: string) => {
    if (!from || to) {
      setFrom(id);
      setTo('');
    } else if (id !== from) setTo(id);
  };
  const chosen = types.find((x) => x.type.id === robot)?.type;
  const error = bookingError({ robotType: robot, from, to });
  // saved routes (workflows with no material) the person may run: shown first, the custom trip is the other way in
  const routes = useMemo(() => routeItems(Object.values(workflows), me, fleetLiveOf), [workflows, me]);
  const showRoutes = mode === 'routes' && routes.length > 0;
  const [confirmCustom, setConfirmCustom] = useState(false);
  const book = () => {
    setConfirmCustom(false);
    if (!fleet || !chosen || error) return;
    const t = bookingsStore.getState().book(
      { username: user.username, name: user.name },
      {
        fleet: fleet.id,
        fleetLive,
        robotType: chosen.id,
        robotLabel: chosen.label,
        from,
        to,
        fromName: nameOf(from),
        toName: nameOf(to),
      },
    );
    if (t) {
      notify.success(copy.book.booked(t.tripId), copy.book.summary(chosen.label, t.fromName, t.toName), 'trip-booked');
      setFrom('');
      setTo('');
      setStep(1);
    } // ready for the next booking
  };
  return (
    <>
      {showRoutes ? (
        <SavedTrips
          routes={routes}
          map={map}
          live={live}
          onCustom={() => {
            setMode('custom');
            setStep(1);
          }}
        />
      ) : (
        <PageCardBody>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-tertiary" aria-live="polite">
              {copy.book.stepOf(step, 2)}
            </p>
            {routes.length > 0 && (
              <Button size="md" color="tertiary" iconLeading={ArrowLeft} onPress={() => setMode('routes')}>
                {copy.routes.back}
              </Button>
            )}
          </div>
          {step === 1 && mine.length > 1 && (
            <Select
              label={copy.book.fleet}
              size="md"
              selectedKey={fleet?.id ?? null}
              onSelectionChange={(k) => setFleetId(String(k))}
              items={mine.map((f) => ({ id: f.id, label: f.name }))}
              className="max-w-sm"
            >
              {(item) => <Select.Item {...item} />}
            </Select>
          )}
          {!fleet || !types.length ? (
            <EmptyState icon={Route} title={copy.book.noRobots} subtext={copy.book.noRobotsHint} size="lg" />
          ) : step === 1 ? (
            <RobotStep
              types={types}
              selected={robot}
              free={telemetry ? freeOf : undefined}
              onSelect={(id) => {
                setRobot(id);
                setStep(2);
              }}
            />
          ) : (
            <StationsStep
              robot={chosen}
              map={fleet ? (fleetScene(fleet.id, map) ?? null) : null} // the chosen fleet's own map, the latest published version
              stations={stations}
              from={from}
              to={to}
              pickStep={pickStep}
              error={error}
              summary={chosen ? copy.book.summary(chosen.label, nameOf(from), nameOf(to)) : ''}
              onChangeRobot={() => setStep(1)}
              onFrom={setFrom}
              onTo={setTo}
              onSwap={() => {
                setFrom(to);
                setTo(from);
              }}
              onPick={pick}
              onSubmit={() => setConfirmCustom(true)}
            />
          )}
        </PageCardBody>
      )}
      <CustomCallSheet
        isOpen={confirmCustom}
        trip={chosen && !error ? { robot: chosen.label, from: nameOf(from), to: nameOf(to) } : null}
        onOpenChange={setConfirmCustom}
        onSend={book}
      />
    </>
  );
}
