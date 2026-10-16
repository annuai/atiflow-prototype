import type { EntityType, SearchContext, SearchEntity, SearchProvider } from './types';

/**
 * Everything that can be searched. A new entity = one registration (`entities/<name>.ts`) added in `entities/index.ts`; the search screens do not change.
 * A server-backed provider for a type is set with `useProvider(type, provider)` and replaces the local search of that type.
 */
class SearchRegistry {
  private entities = new Map<EntityType, SearchEntity<never>>();
  private providers = new Map<EntityType, SearchProvider>();
  register<T>(e: SearchEntity<T>) {
    this.entities.set(e.type, e as unknown as SearchEntity<never>);
  }
  useProvider(type: EntityType, p: SearchProvider) {
    this.providers.set(type, p);
  }
  provider(type: EntityType) {
    return this.providers.get(type);
  }
  get(type: EntityType) {
    return this.entities.get(type);
  }
  all() {
    return [...this.entities.values()] as unknown as SearchEntity<unknown>[];
  }
  /** The entities this person may search: the permission check runs here, before any data is read. */
  allowed(ctx: SearchContext) {
    return this.all().filter((e) => e.permission(ctx));
  }
}
export const searchRegistry = new SearchRegistry();
