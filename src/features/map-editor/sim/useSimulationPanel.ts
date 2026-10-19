import { useMemo, useState } from 'react';
import { ROBOT_TYPES } from '@/data/robotTypes';
import type { SimChoice } from '../components/SimulationPanel';
import { copy } from '../copy';
import { planTrip } from '../model/simulate';
import { nodeOf } from '../model/stations';
import type { MapData, Selection } from '../model/types';
import { useTripSimulation } from './tripSim';

/**
 * Everything the Simulation mode needs: the robot type and the two stations chosen, the trip being driven, the reason a trip cannot be driven, and the two ringed stations on the map.
 * In Simulation a click on a station fills the start, then the end; a click after both are set starts over with a new start.
 */
export function useSimulationPanel(data: MapData | undefined, fleetLive: string | undefined) {
  const trip = useTripSimulation();
  const [choice, setChoice] = useState<SimChoice>({ type: ROBOT_TYPES[0].label, start: '', end: '' });
  const [error, setError] = useState('');
  const marks = useMemo(
    () =>
      data
        ? (['start', 'end'] as const).flatMap((k) => {
            const st = data.stations.find((x) => x.id === choice[k]);
            const n = st && nodeOf(data, st);
            return n ? [{ kind: k, p: { x: n.x, y: n.y } }] : [];
          })
        : [],
    [data, choice],
  );
  return {
    trip,
    choice,
    error,
    marks,
    setChoice: (c: SimChoice) => {
      setChoice(c);
      setError('');
    },
    /** back to nothing chosen to run (leaving Simulation, opening another version) */
    stop() {
      trip.stop();
      setError('');
    },
    pick(sel: Selection) {
      if (!sel || sel.kind !== 'station' || trip.state.status === 'running') return;
      setError('');
      if (!choice.start || choice.end) setChoice({ ...choice, start: sel.id, end: '' });
      else if (sel.id !== choice.start) setChoice({ ...choice, end: sel.id });
    },
    run() {
      if (!data) return; // an imported map no fleet runs yet has the empty fleet id: that is a valid map to simulate on
      const a = data.stations.find((x) => x.id === choice.start),
        b = data.stations.find((x) => x.id === choice.end);
      const p = planTrip(data, fleetLive ?? '', choice.start, choice.end);
      if (!p.ok || !a || !b) {
        setError(
          !p.ok && p.reason === 'same'
            ? copy.sim.sameStation
            : !p.ok && p.reason === 'unlinked'
              ? copy.sim.unlinked(data.stations.find((x) => x.id === p.station)?.name ?? p.station)
              : !p.ok && p.reason === 'no-route' && a && b
                ? copy.sim.noRoute(a.name, b.name)
                : copy.sim.missing,
        );
        return;
      }
      setError('');
      void trip.run(p, choice.type, a.name, b.name);
    },
  };
}
