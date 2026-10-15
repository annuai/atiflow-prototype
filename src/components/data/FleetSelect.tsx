import { Select } from '@/components/base/select/select';
import { fleetDirectory } from '@/data/fleetDirectory';
import { useVisibleFleets } from '@/features/access/useFleetScope';

export interface FleetOption {
  id: string;
  label: string;
}
/** Fleets as options. A fleet's id is the id its map uses (`liveId`) when it has one, otherwise its own id. */
export const useFleetOptions = (): FleetOption[] =>
  useVisibleFleets().map((f) => ({ id: f.liveId ?? f.id, label: f.name }));

/** Dropdown of the site's fleets (names from the shared fleet list), with an optional "All fleets" entry. Reusable on any page that filters by fleet. */
export function FleetSelect({
  value,
  onChange,
  includeAll = true,
  allLabel = 'All fleets',
  className,
  size = 'sm',
  ariaLabel = 'Fleet',
}: {
  value: string;
  onChange(id: string): void;
  includeAll?: boolean;
  allLabel?: string;
  className?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}) {
  const options = useFleetOptions();
  const items = includeAll ? [{ id: 'all', label: allLabel }, ...options] : options;
  return (
    <Select
      size={size}
      aria-label={ariaLabel}
      className={className}
      selectedKey={value}
      onSelectionChange={(k) => onChange(String(k))}
      items={items}
    >
      {(item) => <Select.Item {...item} />}
    </Select>
  );
}

/** A fleet's name with its colour dot, looked up by its map id (`asrs`), its own id or its name. */
export function FleetName({ id, name, dot = true }: { id?: string; name?: string; dot?: boolean }) {
  const f =
    (id && (fleetDirectory.byLiveId(id) ?? fleetDirectory.byId(id))) ||
    (name ? fleetDirectory.byName(name) : undefined);
  return (
    <span className="inline-flex items-center gap-1.5">
      {dot && f && <i className="size-2 rounded-full" style={{ background: f.color }} aria-hidden />}
      {f?.name ?? name ?? id ?? ''}
    </span>
  );
}
