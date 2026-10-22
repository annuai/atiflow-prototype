import { describe, expect, it } from 'vitest';
import { canCreateFleet } from '../src/features/fleets/model/logic';
import { milestoneFor } from '../src/features/onboarding/model/milestones';
import { SETUP_ORDER, setupState, type SetupFacts } from '../src/features/onboarding/model/setup';
import { TOURS } from '../src/features/onboarding/model/tours';

const none: SetupFacts = {
  robots: 0,
  maps: 0,
  hardware: 0,
  hardwareSkipped: false,
  fleetReady: false,
  materials: 0,
  workflows: 0,
};

describe('setup steps are read from the data', () => {
  it('an empty site is 0 of 6 and the next step is the first robot, in the order robot, map, hardware, fleet, materials, workflow', () => {
    const s = setupState(none);
    expect([s.done, s.total, s.percent, s.next, s.complete]).toEqual([0, 6, 0, 'robot', false]);
    expect(SETUP_ORDER).toEqual(['robot', 'map', 'hardware', 'fleet', 'materials', 'workflow']);
  });
  it('each step turns done from its own fact, and the next step is the first one that is not', () => {
    expect(setupState({ ...none, robots: 2 })).toMatchObject({ done: 1, next: 'map' });
    expect(setupState({ ...none, robots: 1, maps: 1 })).toMatchObject({ done: 2, next: 'hardware' });
    expect(setupState({ ...none, robots: 1, maps: 1, hardware: 3 })).toMatchObject({ done: 3, next: 'fleet' });
  });
  it('hardware may be skipped (a site without any), and a skip is shown as skipped, not as having hardware', () => {
    const s = setupState({ ...none, robots: 1, maps: 1, hardwareSkipped: true });
    expect(s.steps.find((x) => x.id === 'hardware')).toMatchObject({ done: true, skipped: true, optional: true });
    expect(setupState({ ...none, hardware: 1, hardwareSkipped: true }).steps[2].skipped).toBe(false);
  });
  it('the workflow comes last, and setup is complete only when all six are done', () => {
    const all = {
      robots: 1,
      maps: 1,
      hardware: 1,
      hardwareSkipped: false,
      fleetReady: true,
      materials: 4,
      workflows: 2,
    };
    expect(setupState(all)).toMatchObject({ complete: true, next: null, percent: 100 });
    expect(setupState({ ...all, materials: 0 }).complete).toBe(false);
    expect(setupState({ ...all, workflows: 0 })).toMatchObject({ complete: false, next: 'workflow', done: 5 });
  });
  it('a fleet can be made once the site has a map', () => {
    expect(canCreateFleet(0)).toBe(false);
    expect(canCreateFleet(1)).toBe(true);
  });
});

describe('milestones fire when a step is finished, never for what was already there', () => {
  const was = setupState(none);
  it('nothing on the first look, nothing when nothing changed', () => {
    expect(milestoneFor(null, setupState({ ...none, robots: 3 }))).toBeNull();
    expect(milestoneFor(was, was)).toBeNull();
  });
  it('the robot, the map and the fleet are celebrated; hardware and materials are quiet', () => {
    expect(milestoneFor(was, setupState({ ...none, robots: 1 }))).toBe('robot');
    expect(milestoneFor(setupState({ ...none, robots: 1 }), setupState({ ...none, robots: 1, maps: 1 }))).toBe('map');
    expect(milestoneFor(was, setupState({ ...none, hardware: 1 }))).toBeNull();
    expect(milestoneFor(was, setupState({ ...none, materials: 9 }))).toBeNull();
  });
  it('when several finish at once the last of them in the setup order is the one celebrated', () => {
    expect(milestoneFor(was, setupState({ ...none, robots: 1, maps: 1 }))).toBe('map');
  });
});

describe('walkthroughs', () => {
  it('every step has a page, a target name and its words', () => {
    for (const tour of Object.values(TOURS)) {
      expect(tour.steps.length).toBeGreaterThan(2);
      for (const s of tour.steps) {
        expect(s.target).toMatch(/^[a-z-]+$/);
        if (s.route) expect(s.route.startsWith('/' + tour.id)).toBe(true);
        const t = s.text();
        expect(t.title.length).toBeGreaterThan(2);
        expect(t.body.length).toBeGreaterThan(10);
      }
    }
  });
});
