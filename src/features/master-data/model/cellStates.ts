import type { BadgeColors } from '@/components/base/badges/badge-types';
import { t } from '../text';
import type { CellState } from './types';

export interface CellStateDef {
  id: CellState;
  readonly label: string;
  badge: BadgeColors;
  /** Tailwind classes of a grid cell in this state. */ cell: string;
  /** Can the user toggle it in Manage mode? */ manual: boolean;
}
/** ONE table drives the cells, the legend and the Manage-mode rules. Add a state here and both appear. */
export const CELL_STATES: CellStateDef[] = [
  {
    id: 'available',
    get label() {
      return t.masterData.cellStates.available;
    },
    badge: 'brand',
    manual: true,
    cell: 'bg-utility-brand-50 border-utility-brand-300 hover:border-utility-brand-500',
  },
  {
    id: 'reserved',
    get label() {
      return t.masterData.cellStates.reserved;
    },
    badge: 'warning',
    manual: false,
    cell: 'bg-utility-yellow-50 border-utility-yellow-300',
  },
  {
    id: 'blocked',
    get label() {
      return t.masterData.cellStates.blocked;
    },
    badge: 'error',
    manual: true,
    cell: 'bg-utility-red-50 border-utility-red-300 hover:border-utility-red-500',
  },
  {
    id: 'filled',
    get label() {
      return t.masterData.cellStates.filled;
    },
    badge: 'blue',
    manual: false,
    cell: 'bg-utility-blue-50 border-utility-blue-300',
  },
];
export const cellState = (id: CellState) => CELL_STATES.find((s) => s.id === id)!;
