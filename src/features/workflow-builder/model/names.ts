import { copy } from '../copy';
/** Default workflow name: "<fleet>_workflow_<n>", n = the first number not used by another workflow of the fleet. */
export function defaultWorkflowName(fleet: string, taken: string[] = []): string {
  const used = new Set(taken.map((t) => t.toLowerCase()));
  let n = 1;
  while (used.has(`${fleet}_workflow_${n}`.toLowerCase())) n++;
  return `${fleet}_workflow_${n}`;
}
/** Error text for a workflow name typed by the user, or '' when it is fine. */
export const workflowNameError = (name: string) => (name.trim() ? '' : copy.problems.nameNeeded);

/** Error text for a new fleet name (empty or already used by another fleet, ignoring case), or '' when fine. `current` is the fleet being renamed. */
export function fleetNameError(name: string, existing: string[], current?: string): string {
  const n = name.trim();
  if (!n) return copy.problems.fleetNameNeeded;
  return existing.some((f) => f !== current && f.toLowerCase() === n.toLowerCase()) ? copy.problems.fleetExists(n) : '';
}
