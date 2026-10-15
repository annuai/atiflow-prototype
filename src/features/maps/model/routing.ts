import type { FC } from 'react';
import { LayersThree01, Zap } from '@untitledui/icons';

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
    name: 'Point to point routing',
    note: 'Still in use but not as easy to implement as v5',
    icon: LayersThree01,
  },
  { id: 'v4', version: 4, label: 'v4', name: 'Dynamic Routing', note: 'Now deprecated', icon: LayersThree01 },
  {
    id: 'v5',
    version: 5,
    label: 'v5 (Recommended)',
    name: 'Dynamic Routing',
    note: 'This option is recommended.',
    recommended: true,
    icon: Zap,
  },
];
export const DEFAULT_ROUTING = ROUTING_VERSIONS.find((r) => r.recommended)!.id;
export const routingName = (version: number) => ROUTING_VERSIONS.find((r) => r.version === version)?.name ?? '';
