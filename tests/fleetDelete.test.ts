import { describe, expect, it } from 'vitest';
import { datasetStore } from '../src/data/dataset';
import { userDirectory } from '../src/features/auth';
import { bookingsStore } from '../src/features/bookings';
import { deleteFleet, fleetImpact } from '../src/features/fleets/model/delete';
import { fleetsStore } from '../src/features/fleets/model/store';
import { masterDataStore } from '../src/features/master-data';
import { wfStore, workflowsOfFleet } from '../src/features/workflow-builder';

const NAME = 'Doomed Fleet';
function makeFleet() {
  const f = datasetStore.getState().addFleet(NAME);
  datasetStore.getState().updateDevice('robot', 'AMR-001', { fleet: NAME });
  const code = masterDataStore.getState().materials[0].code;
  masterDataStore.getState().assignMaterials([code], NAME);
  fleetsStore.getState().assignMap(NAME, 'main-assembly');
  const id = wfStore.getState().startWorkflow(NAME);
  wfStore.getState().saveDraft();
  userDirectory
    .getState()
    .update('arjun', {
      fleets: [...(userDirectory.getState().users.find((u) => u.username === 'arjun')!.fleets ?? []), f.id],
    });
  return { id, code, fleetId: f.id };
}

describe('delete a fleet', () => {
  it('says what it will touch', () => {
    makeFleet();
    const i = fleetImpact(NAME);
    expect(i.robots).toBe(1);
    expect(i.materials).toBe(1);
    expect(i.workflows).toBe(1);
    expect(i.users).toBe(1);
    expect(i.openTrips).toBe(0);
    deleteFleet(NAME);
  });
  it('removes the fleet and everything that belongs to it, and keeps what is only assigned to it', () => {
    const { code, fleetId } = makeFleet();
    const robotCount = datasetStore.getState().robot.length;
    expect(deleteFleet(NAME)).toBe(true);
    expect(datasetStore.getState().fleets.some((f) => f.name === NAME)).toBe(false);
    expect(datasetStore.getState().robot.length).toBe(robotCount); // the robot stays registered...
    expect(datasetStore.getState().robot.find((r) => r.values.name === 'AMR-001')!.values.fleet).toBe(''); // ...unassigned
    expect(masterDataStore.getState().materials.find((m) => m.code === code)!.fleets).not.toContain(NAME);
    expect(fleetsStore.getState().profiles[NAME]).toBeUndefined();
    expect(workflowsOfFleet(wfStore.getState().workflows, NAME)).toEqual([]);
    expect(userDirectory.getState().users.find((u) => u.username === 'arjun')!.fleets).not.toContain(fleetId);
  });
  it('other fleets are untouched', () => {
    const before = datasetStore.getState().fleets.map((f) => f.name);
    makeFleet();
    deleteFleet(NAME);
    expect(datasetStore.getState().fleets.map((f) => f.name)).toEqual(before);
    expect(datasetStore.getState().robot.filter((r) => r.values.fleet === 'Line Side Fleet').length).toBeGreaterThan(0);
  });
  it('is refused while a trip of the fleet is still open', () => {
    makeFleet();
    bookingsStore.setState({
      trips: [
        { id: 'BKG-9', fleet: NAME, status: 'approved' } as unknown as ReturnType<
          typeof bookingsStore.getState
        >['trips'][number],
      ],
    });
    expect(fleetImpact(NAME).openTrips).toBe(1);
    expect(deleteFleet(NAME)).toBe(false);
    expect(datasetStore.getState().fleets.some((f) => f.name === NAME)).toBe(true);
    bookingsStore.setState({ trips: [] });
    expect(deleteFleet(NAME)).toBe(true);
  });
});
