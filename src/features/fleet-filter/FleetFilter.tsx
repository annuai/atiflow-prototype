import { FleetSelect } from '@/features/auth';
import { useFleetFilter } from './useFleetFilter';

/** "All fleets / one fleet" dropdown for the top right of a supervisor page. Nothing for a person who sees only one fleet. */
export function FleetFilter({ className }: { className?: string }) {
  const { fleetId, many, choose } = useFleetFilter();
  if (!many) return null;
  return <FleetSelect value={fleetId} onChange={choose} className={className ?? 'w-48'} size="sm" />;
}
