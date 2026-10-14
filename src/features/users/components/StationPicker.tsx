import { MarkerPin01 } from '@untitledui/icons';
import { TagMultiSelect } from '@/components/form/TagMultiSelect';
import { useDataset } from '@/data/dataset';
import { fleetStations, useMapData } from '@/features/workflow-builder/model/stations';
import { copy } from '../copy';

/**
 * "Stations": the stations an operator is responsible for (a search box whose picks become tags). They request materials for workflows that deliver to one of them and approve at the
 * Confirm steps placed at one of them. Only stations of the person's own fleets are offered (all fleets when the person is not fleet-scoped).
 */
export function StationPicker({ value, onChange, fleetIds }: { value: string[]; onChange(ids: string[]): void; /** the fleets the person works on; empty = every fleet */ fleetIds: string[] }) {
  const fleets = useDataset((s) => s.fleets); const map = useMapData();
  const names = (fleetIds.length ? fleets.filter((f) => fleetIds.includes(f.id)) : fleets).map((f) => f.name);
  const stations = [...new Map(names.flatMap((n) => fleetStations(n, map)).map((s) => [s.id, s])).values()];
  const options = [...stations.map((s) => ({ id: s.id, label: `${s.id} · ${s.name}`, icon: MarkerPin01 })), ...value.filter((id) => !stations.some((s) => s.id === id)).map((id) => ({ id, label: id, icon: MarkerPin01 }))];          // a saved station stays visible even when its fleet no longer offers it
  return <TagMultiSelect label={copy.stations.label} options={options} value={value} onChange={onChange} placeholder={copy.stations.placeholder} hint={copy.stations.hint} />;
}
