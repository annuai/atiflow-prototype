import { TagMultiSelect } from '@/components/form/TagMultiSelect';
import { useDataset } from '@/data/dataset';
import fleetHash from '@/ui/icons/fleet.svg';
import { copy } from '../copy';

/** The fleet hash, the same glyph the sidebar uses for fleets. */
const FleetHash = ({ className }: { className?: string }) => <img src={fleetHash} alt="" className={className} />;

/** "Assigned fleets": search a fleet and it is added as a tag (close button to remove it). Stored by fleet id, shown by name. At least one is required, the form reports it through `error`. */
export function FleetPicker({ value, onChange, error }: { value: string[]; onChange(ids: string[]): void; error?: string }) {
  const fleets = useDataset((s) => s.fleets);
  return <TagMultiSelect label={copy.fleets.label} options={fleets.map((f) => ({ id: f.id, label: f.name, icon: FleetHash }))} value={value} onChange={onChange} placeholder={copy.fleets.placeholder} hint={copy.fleets.hint} error={error} required />;
}
