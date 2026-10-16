import { useCallback, useEffect, useRef } from 'react';
import { store as appStore } from '@/core/store';
import type { RobotTelemetry } from '@/core/types';
import { useFleetDirectory } from '@/data/fleetDirectory';
import { robotTypeById } from '@/data/robotTypes';
import { useAuth } from '@/features/auth';
import { bookingsStore, cancelBooking, isFreeRobot, useBookingsRunning } from '@/features/bookings';
import { STATUS, requestsStore, useOperator } from '@/features/requests';
import { fleetStations, stationLabel, useMapData } from '@/features/workflow-builder';
import { notify } from '@/ui/toast';
import type { Context, RobotView, TripView } from './types';

/** What the robot is doing, in words a person on the floor understands. */
function doing(r: RobotTelemetry, name: (id: string) => string): string {
  if (r.state === 'charging') return 'charging';
  if (r.state === 'error') return 'in an error state and needs help';
  if (r.state === 'blocked') return 'blocked by something in its way';
  if (r.state === 'offline') return 'offline';
  if (r.waitReason || r.state === 'waiting')
    return r.waitsOn?.length ? `waiting for ${r.waitsOn[0]} to pass` : 'waiting for the road to clear';
  if (r.task?.next && r.task.type !== 'park') return `driving to ${name(r.task.next)}`;
  return r.task?.type === 'park' ? 'parked' : 'free and parked';
}

/**
 * Builds what the assistant may know about the app at the moment a message is sent (the signed-in person, their fleet's stations and robots, their trips) and the three things it can
 * change after a confirmation. Only the open panel uses it, so the map and the live feed are not loaded for people who never open the assistant.
 */
export function useAiContext(): () => Context {
  useBookingsRunning();
  const user = useAuth((s) => s.user)!;
  const me = useOperator();
  const fleets = useFleetDirectory();
  const map = useMapData();
  const fleet = fleets.find((f) => me.fleets.includes(f.id)) ?? null;
  const latest = useRef({ user, fleet, map });
  useEffect(() => {
    latest.current = { user, fleet, map };
  });
  return useCallback((): Context => {
    const { user: u, fleet: f, map: m } = latest.current;
    const live = f ? (f.liveId ?? f.id) : '';
    const stationList = f ? fleetStations(f.name, m) : [];
    const stations = stationList.map((s) => ({ id: s.id, name: s.name }));
    const nm = (id: string) => stations.find((s) => s.id === id)?.name ?? id;
    const telemetry = Object.values(appStore.getState().robots).filter((r) => r.fleetId === live);
    const robots: RobotView[] = telemetry.map((r) => ({
      id: r.id,
      model: r.model,
      label: robotTypeById(r.model).label,
      battery: r.battery,
      state: r.state,
      doing: doing(r, nm),
      free: isFreeRobot(r),
    }));
    const bookings: TripView[] = bookingsStore
      .getState()
      .trips.filter((t) => t.bookedBy === u.username)
      .map((t) => ({
        bookingId: t.id,
        tripId: t.tripId,
        status: t.status,
        statusLabel: STATUS[t.status].label,
        cancellable: STATUS[t.status].cancellable,
        from: t.from,
        to: t.to,
        fromName: nm(t.from),
        toName: nm(t.to),
        robotId: t.robotId,
        robotLabel: t.robotLabel,
        at: t.createdAt,
      }));
    const requested: TripView[] = requestsStore
      .getState()
      .requests.filter((r) => r.requestedBy === u.username && r.legs.length > 1)
      .map((r) => ({
        bookingId: r.id,
        tripId: r.tripId,
        status: r.status,
        statusLabel: STATUS[r.status].label,
        cancellable: false, // requests are cancelled in History (they have their own rules)
        from: r.legs[0],
        to: r.legs[r.legs.length - 1],
        fromName: nm(r.legs[0]),
        toName: nm(r.legs[r.legs.length - 1]),
        robotId: r.robotId,
        robotLabel: r.robotType ? robotTypeById(r.robotType).label : '',
        at: r.createdAt,
      }));
    return {
      user: { username: u.username, name: u.name },
      fleet: f ? { id: f.id, name: f.name } : null,
      stations,
      robots,
      trips: [...bookings, ...requested].sort((a, b) => b.at - a.at),
      range: '7d',
      booking: null,
      workflow: null,
      now: Date.now(),
      actions: {
        bookTrip(a) {
          if (!f) return null;
          const label = (id: string) => {
            const s = stationList.find((x) => x.id === id);
            return s ? stationLabel(s) : id;
          };
          const t = bookingsStore.getState().book(
            { username: u.username, name: u.name },
            {
              fleet: f.name,
              fleetLive: live,
              robotType: a.robotType,
              robotLabel: a.robotLabel,
              from: a.from,
              to: a.to,
              fromName: label(a.from),
              toName: label(a.to),
            },
          );
          return t ? { tripId: t.tripId, bookingId: t.id } : null;
        },
        cancelTrip: (id) => cancelBooking(id, { username: u.username }),
        callSupervisor: () =>
          notify.success('Supervisor called', 'Prototype: nobody was really notified.', 'ati-ai-supervisor'),
      },
    };
  }, []);
}
