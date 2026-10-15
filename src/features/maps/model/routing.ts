import type { FC } from 'react';
import { LayersThree01, Zap } from '@untitledui/icons';
import { t } from '../text';

export interface RoutingVersion {
  id: string;
  version: number;
  label: string;
  name: string;
  note: string;
  recommended?: boolean;
  icon: FC<{ className?: string }>;
}
/** Routing versions a map can be generated with (from the design). v5 is the default. */
export const ROUTING_VERSIONS: RoutingVersion[] = [
  {
    id: 'v2',
    version: 2,
    label: 'v2',
    get name() {
      return t.maps.routing.v2.name;
    },
    get note() {
      return t.maps.routing.v2.note;
    },
    icon: LayersThree01,
  },
  {
    id: 'v4',
    version: 4,
    label: 'v4',
    get name() {
      return t.maps.routing.v4.name;
    },
    get note() {
      return t.maps.routing.v4.note;
    },
    icon: LayersThree01,
  },
  {
    id: 'v5',
    version: 5,
    get label() {
      return t.maps.routing.v5.label;
    },
    get name() {
      return t.maps.routing.v5.name;
    },
    get note() {
      return t.maps.routing.v5.note;
    },
    recommended: true,
    icon: Zap,
  },
];
export const DEFAULT_ROUTING = ROUTING_VERSIONS.find((r) => r.recommended)!.id;
export const routingName = (version: number) => ROUTING_VERSIONS.find((r) => r.version === version)?.name ?? '';
