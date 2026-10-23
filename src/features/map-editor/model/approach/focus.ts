import { create } from 'zustand';
import type { SlotId } from './types';

/** Which slot of which node is being looked at: the map draws its path and handles. Cleared when the station changes. */
interface Focus {
  station: string | null;
  node: number;
  slot: SlotId | null;
  set(station: string, node: number, slot: SlotId | null): void;
  clear(): void;
}
export const useApproachFocus = create<Focus>((set) => ({
  station: null,
  node: 0,
  slot: null,
  set: (station, node, slot) => set({ station, node, slot }),
  clear: () => set({ station: null, node: 0, slot: null }),
}));
