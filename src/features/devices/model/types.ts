import type { FC, ReactNode } from 'react';
import type { FieldDef, FieldValue } from '@/components/form/types';

export type DeviceKindId = 'robot' | 'hardware';
export type { FieldDef, FieldValue } from '@/components/form/types';
export type DeviceStatus = 'online' | 'offline';

/** One stored robot / hardware record. `values` is keyed by FieldDef.key; `values.name` is the unique name, `values.fleet` the fleet ('' = unassigned). */
export interface Device {
  status: DeviceStatus;
  values: Record<string, FieldValue>;
}

export interface EmptyStateDef {
  headline: string;
  description: string;
  hint?: string;
  prompt?: string;
  quickPicks?: { label: string; value: string; icon: FC<{ className?: string }> }[];
}

/** Everything that differs between Robots and Hardware. Add another device kind (maps, chargers...) by adding one more entry in kinds.tsx. */
export interface DeviceKind {
  id: DeviceKindId;
  route: string; // path segment under /configurator
  singular: string;
  plural: string;
  subtitle: string;
  addLabel: string;
  addSubtitle: string;
  columns: { name: string; type: string };
  detail: { heading: string; description: string; tabs?: string[] };
  fields: FieldDef[];
  icon: FC<{ className?: string }>; // featured icon of the Add modal
  typeOf(d: Device): string; // text of the "type" column / badge
  headerBadges(d: Device): string[]; // neutral badges next to the big name on the detail page
  thumb(d: Device): ReactNode; // list-row picture
  illustration(d: Device): ReactNode; // detail header picture
  preview(values: Record<string, FieldValue>): { heading?: string; image: ReactNode; caption: string };
  empty: EmptyStateDef;
  seed: Device[];
}
