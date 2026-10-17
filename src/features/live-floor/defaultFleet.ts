import { fleetDirectory } from '@/data/fleetDirectory';
import { visibleLiveIds } from '@/features/auth';

/** The ids (as the floor knows them) of the fleets this person may see, in the order of the fleet list. */
export function visibleFleetIds(): string[] {
  const ids = visibleLiveIds();
  return fleetDirectory
    .list()
    .map((f) => f.liveId ?? f.id)
    .filter((id) => !ids || ids.has(id));
}

/**
 * The fleet the Live Floor shows. There is no "all fleets" view: it always shows ONE fleet. The one already chosen stays; otherwise the person's own choice (Preferences > Start page);
 * otherwise the first fleet they can see that is on the floor, else the first they can see (the floor then says why it is not on it). null: they can see no fleet.
 */
export function chooseFleet(o: {
  current: string;
  visible: string[];
  running: string[];
  preferred: string;
}): string | null {
  if (o.visible.includes(o.current)) return o.current;
  if (o.visible.includes(o.preferred)) return o.preferred;
  return o.visible.find((id) => o.running.includes(id)) ?? o.visible[0] ?? null;
}
