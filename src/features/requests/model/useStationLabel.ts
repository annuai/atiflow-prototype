import { useMapData } from '@/features/workflow-builder/model/stations';

/** "STA-116 · VStore - ASRS 1" for a station id (just the id until the map has loaded). */
export function useStationLabel(): (id: string) => string {
  const m = useMapData(); return (id) => { const s = m?.nav.stations.find((x) => x.id === id); return s ? `${s.id} · ${s.name}` : id; };
}
