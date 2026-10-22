import { useMemo } from 'react';
import { useDataset } from '@/data/dataset';
import { useMaps } from '@/features/maps';
import { useFleets } from '@/features/fleets';
import { useMasterData } from '@/features/master-data';
import { useWorkflow } from '@/features/workflow-builder';
import { useProgress } from './progress';
import { setupState, type SetupFacts, type SetupState } from './setup';

/** The facts of the site, read live from the stores that hold them. */
export function useSetupFacts(): SetupFacts {
  const robot = useDataset((s) => s.robot);
  const hardware = useDataset((s) => s.hardware);
  const fleets = useDataset((s) => s.fleets);
  const profiles = useFleets((s) => s.profiles);
  const maps = useMaps();
  const materials = useMasterData((s) => s.materials.length);
  const workflows = useWorkflow((s) => s.workflows);
  const skipped = useProgress((s) => s.hardwareSkipped);
  return useMemo(
    () => ({
      robots: robot.length,
      maps: maps.length,
      hardware: hardware.length,
      hardwareSkipped: skipped,
      fleetReady: fleets.some((f) => !!profiles[f.id]?.mapId && robot.some((r) => r.values.fleet === f.id)),
      materials,
      workflows: Object.values(workflows).filter((w) => w.published).length,
    }),
    [robot, hardware, fleets, profiles, maps, materials, workflows, skipped],
  );
}
export function useSetup(): SetupState {
  const facts = useSetupFacts();
  return useMemo(() => setupState(facts), [facts]);
}
