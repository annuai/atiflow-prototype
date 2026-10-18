import { FLEET_ID, asFleetId } from '../src/data/fleets';
import { describe, expect, it } from 'vitest';
import { datasetStore } from '../src/data/dataset';
import { userDirectory } from '../src/features/auth';
import { bookingsStore } from '../src/features/bookings';
import { deleteFleet, fleetImpact } from '../src/features/fleets/model/delete';
import { fleetsStore } from '../src/features/fleets/model/store';
import { masterDataStore } from '../src/features/master-data';
import { wfStore, workflowsOfFleet } from '../src/features/workflow-builder';

const NAME = 'Doomed Fleet';
const ID = asFleetId('doomed-fleet'); // (the id a fleet called that is given)
function makeFleet() {
  const f = datasetStore.getState().addFleet(NAME);
  datasetStore.getState().updateDevice('robot', 'AMR-001', { fleet: ID });
  const code = masterDataStore.getState().materials[0].code;
  masterDataStore.getState().assignMaterials([code], ID);
  fleetsStore.getState().assignMap(ID, 'main-assembly');
  const id = wfStore.getState().startWorkflow(ID);
  wfStore.getState().saveDraft();
  userDirectory.getState().update('arjun', {
    fleets: [...(userDirectory.getState().users.find((u) => u.username === 'arjun')!.fleets ?? []), f.id],
  });
  return { id, code, fleetId: f.id };
}

describe('delete a fleet', () => {
  it('says what it will touch', () => {
    makeFleet();
    const i = fleetImpact(ID);
    expect(i.robots).toBe(1);
    expect(i.materials).toBe(1);
    expect(i.workflows).toBe(1);
    expect(i.users).toBe(1);
    expect(i.openTrips).toBe(0);
    deleteFleet(ID);
  });
  it('removes the fleet and everything that belongs to it, and keeps what is only assigned to it', () => {
    const { code, fleetId } = makeFleet();
    const robotCount = datasetStore.getState().robot.length;
    expect(deleteFleet(ID)).toBe(true);
    expect(datasetStore.getState().fleets.some((f) => f.name === NAME)).toBe(false);
    expect(datasetStore.getState().robot.length).toBe(robotCount); // the robot stays registered...
    expect(datasetStore.getState().robot.find((r) => r.values.name === 'AMR-001')!.values.fleet).toBe(''); // ...unassigned
    expect(masterDataStore.getState().materials.find((m) => m.code === code)!.fleets).not.toContain(ID);
    expect(fleetsStore.getState().profiles[ID]).toBeUndefined();
    expect(workflowsOfFleet(wfStore.getState().workflows, ID)).toEqual([]);
    expect(userDirectory.getState().users.find((u) => u.username === 'arjun')!.fleets).not.toContain(fleetId);
  });
  it('other fleets are untouched', () => {
    const before = datasetStore.getState().fleets.map((f) => f.name);
    makeFleet();
    deleteFleet(ID);
    expect(datasetStore.getState().fleets.map((f) => f.name)).toEqual(before);
    expect(datasetStore.getState().robot.filter((r) => r.values.fleet === FLEET_ID.lineSide).length).toBeGreaterThan(0);
  });
  it('is refused while a trip of the fleet is still open', () => {
    makeFleet();
    bookingsStore.setState({
      trips: [
        { id: 'BKG-9', fleet: ID, status: 'approved' } as unknown as ReturnType<
          typeof bookingsStore.getState
        >['trips'][number],
      ],
    });
    expect(fleetImpact(ID).openTrips).toBe(1);
    expect(deleteFleet(ID)).toBe(false);
    expect(datasetStore.getState().fleets.some((f) => f.name === NAME)).toBe(true);
    bookingsStore.setState({ trips: [] });
    expect(deleteFleet(ID)).toBe(true);
  });
});

describe('a map belongs to one fleet', () => {
  it('maps another fleet runs on are not offered, the fleet’s own map is, and the store refuses a taken map', async () => {
    const { availableMaps } = await import('../src/features/fleets/model/logic');
    const maps = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const profiles = { F1: { mapId: 'a' }, F2: { mapId: 'b' }, F3: { mapId: null } };
    const [F1, F3] = [asFleetId('F1'), asFleetId('F3')];
    expect(availableMaps(maps, profiles, F1).map((m) => m.id)).toEqual(['a', 'c']); // its own + the free one
    expect(availableMaps(maps, profiles, F3).map((m) => m.id)).toEqual(['c']);
    // the store: a fleet cannot be given a map that another fleet has
    const one = datasetStore.getState().addFleet('Map Fleet One').id;
    const two = datasetStore.getState().addFleet('Map Fleet Two').id;
    fleetsStore.getState().assignMap(one, 'shared-map');
    fleetsStore.getState().assignMap(two, 'shared-map');
    expect(fleetsStore.getState().profiles[one]?.mapId).toBe('shared-map');
    expect(fleetsStore.getState().profiles[two]?.mapId ?? null).toBeNull();
    fleetsStore.getState().unassignMap(one);
    fleetsStore.getState().assignMap(two, 'shared-map'); // free again once the first fleet lets go
    expect(fleetsStore.getState().profiles[two]?.mapId).toBe('shared-map');
    deleteFleet(one);
    deleteFleet(two);
  });
});
