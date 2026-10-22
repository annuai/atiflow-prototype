import type { SetupState, SetupStepId } from './setup';

/** The setup steps that get a celebration (and the next thing to do) when they are finished. Hardware and materials are quiet: the sidebar card says it. */
export type MilestoneId = Extract<SetupStepId, 'robot' | 'map' | 'fleet'>;
const MILESTONES: MilestoneId[] = ['robot', 'map', 'fleet'];

/**
 * Did a step just get finished? `prev` is the state a moment ago, `cur` the state now; the LAST milestone step that went from not done to done is returned (null = nothing just
 * finished, or there is no `prev` yet: opening the app with robots already there is not an achievement).
 */
export function milestoneFor(prev: SetupState | null, cur: SetupState): MilestoneId | null {
  if (!prev) return null;
  const was = new Map(prev.steps.map((s) => [s.id, s.done]));
  const flipped = MILESTONES.filter((id) => cur.steps.find((s) => s.id === id)?.done && was.get(id) === false);
  return flipped.at(-1) ?? null;
}
