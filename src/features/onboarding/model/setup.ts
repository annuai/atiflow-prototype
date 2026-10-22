/**
 * The setup of a new site, as a short ordered list. Whether a step is done is READ from the real data (a robot exists, a map exists...), never ticked by hand, so the list can
 * not drift from what the site really has. Order (user decision): robot, map, hardware (only if the site has any), then the fleet that everything is assigned to, then materials, and last the workflow.
 */
export type SetupStepId = 'robot' | 'map' | 'hardware' | 'fleet' | 'materials' | 'workflow';
export const SETUP_ORDER: SetupStepId[] = ['robot', 'map', 'hardware', 'fleet', 'materials', 'workflow'];

/** What the site has right now. */
export interface SetupFacts {
  robots: number;
  maps: number;
  hardware: number;
  /** the person said the site has no hardware (so that step counts as done) */
  hardwareSkipped: boolean;
  /** a fleet that has a map and at least one robot */
  fleetReady: boolean;
  materials: number;
  /** workflows that are published (a workflow is what tells the robots what to do, so it comes last) */
  workflows: number;
}
export interface SetupStep {
  id: SetupStepId;
  done: boolean;
  /** hardware may be skipped: not every site has any */
  optional: boolean;
  skipped: boolean;
}
export interface SetupState {
  steps: SetupStep[];
  done: number;
  total: number;
  percent: number;
  /** the first step that is not done (what to do now), null when everything is */
  next: SetupStepId | null;
  complete: boolean;
}

export function setupState(f: SetupFacts): SetupState {
  const doneOf: Record<SetupStepId, boolean> = {
    robot: f.robots > 0,
    map: f.maps > 0,
    hardware: f.hardware > 0 || f.hardwareSkipped,
    fleet: f.fleetReady,
    materials: f.materials > 0,
    workflow: f.workflows > 0,
  };
  const steps = SETUP_ORDER.map((id): SetupStep => ({
    id,
    done: doneOf[id],
    optional: id === 'hardware',
    skipped: id === 'hardware' && f.hardware === 0 && f.hardwareSkipped,
  }));
  const done = steps.filter((s) => s.done).length;
  return {
    steps,
    done,
    total: steps.length,
    percent: Math.round((done / steps.length) * 100),
    next: steps.find((s) => !s.done)?.id ?? null,
    complete: done === steps.length,
  };
}
