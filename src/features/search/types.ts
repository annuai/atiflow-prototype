import type { FC } from 'react';
import type { PermissionId } from '@/features/access';
import type { PublicUser } from '@/features/auth';

export type EntityType =
  | 'robot'
  | 'device'
  | 'trip'
  | 'page'
  | 'station'
  | 'zone'
  | 'workflow'
  | 'material'
  | 'fleet'
  | 'map'
  | 'user'
  | 'metric'
  | 'ticket'
  | 'integration';

/** Who is searching and what they may see. Permission filtering happens in the SERVICE with this, before any entity's data is read. */
export interface SearchContext {
  user: PublicUser;
  /** who and with what rights (user, role, ticks, fleets): results are cached per key, so a change of rights never shows an old answer */
  key: string;
  can(perm: PermissionId): boolean;
  canOpen(path: string): boolean;
  /** lane-map ids of the fleets the person sees (null = all) */ liveFleets: Set<string> | null;
  /** the workspace of the page the person is on (relevance boost) */ workspace: string | null;
  locale: string;
  site: string;
  now: number;
}
export type SearchSort = 'relevance' | 'recent' | 'az';
export interface SearchQuery {
  text: string;
  /** only these types (empty = all the person may see) */ types?: EntityType[];
  filters?: { status?: string; fleet?: string; zone?: string; from?: number; to?: number };
  sort?: SearchSort;
  /** results per type on this page and where it starts */ limit?: number;
  offset?: number;
}
export interface Metadata {
  label: string;
  value: string;
  tone?: 'success' | 'warning' | 'error' | 'brand' | 'gray';
}
export interface SearchAction {
  id: string;
  label: string;
  /** a command changes something (it asks first); a navigation only goes somewhere */ kind: 'navigate' | 'command';
  /** where a navigation goes */ url?: string;
  /** the main thing to do with this result (Enter, and the one button on the operator's cards) */ primary?: boolean;
  /** what a command does: the screens ask first and run it through the app's own rules */
  command?:
    | { kind: 'charger'; robotId: string }
    | { kind: 'cancel-booking'; id: string }
    | { kind: 'cancel-request'; id: string };
}
/** The one shape every result has, whatever it is. A real backend returns the same. */
export interface SearchResult {
  id: string;
  type: EntityType;
  title: string;
  subtitle?: string;
  metadata: Metadata[];
  highlights: { field: 'title' | 'subtitle'; ranges: [number, number][] }[];
  /** a stable address that opens it (shareable) */ url: string;
  actions: SearchAction[];
  score: number;
  /** only robots and trips: their card follows the live feed */ live?: { robotId: string };
  facets?: { status?: string; fleet?: string; zone?: string };
  at?: number;
}
export interface SearchGroup {
  type: EntityType;
  label: string;
  total: number;
  results: SearchResult[];
}
export interface SearchResultPage {
  groups: SearchGroup[];
  total: number;
  tookMs: number;
  /** the closest known word when nothing matched */ didYouMean?: string;
  /** an exact ID was typed: this result is pinned and Enter opens it */ exact?: SearchResult;
}
export interface Suggestion {
  text: string;
  type?: EntityType;
}

/** What one entity gives the search: ONE registration file per entity. */
export interface SearchEntity<T = unknown> {
  type: EntityType;
  label(): string;
  icon: FC<{ className?: string }>;
  permission(ctx: SearchContext): boolean;
  /** the rows, already limited to what this person may see (the search layer never shows more than this) */
  load(ctx: SearchContext): T[];
  fields: { get(t: T): string; weight: number }[];
  id(t: T): string;
  toResult(
    t: T,
    ctx: SearchContext,
  ): Pick<SearchResult, 'title' | 'subtitle' | 'metadata' | 'url' | 'live' | 'facets' | 'at'>;
  actions(t: T, ctx: SearchContext): SearchAction[];
  /** extra score (attention, relevance) */ boost?(t: T, ctx: SearchContext): number;
  /** which workspaces see this type first */ home?: string[];
}
/** The seam to a real backend: a server provider implements this for a `type` and replaces the local one in the registry. */
export interface SearchProvider {
  type: EntityType;
  search(q: SearchQuery, ctx: SearchContext): Promise<{ total: number; results: SearchResult[] }>;
  suggest?(prefix: string, ctx: SearchContext): Promise<Suggestion[]>;
}
