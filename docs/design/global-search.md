# Global Search: design (for sign-off)

Status: **proposal, nothing built yet.** Decisions already taken with the user: client-side providers behind an interface (no backend), current site only, reuse the existing permission checks, live robot / trip data, one input for palette and results page, replace the top-bar search and the Live Floor search box (page filters stay), analytics = placeholder, recent searches per person through the `device` service, five-language chrome, **build "Send to charger"**, do **not** build "send a robot to a location" (operators do it from Book trip).

## 1. What changes for people

- The top-bar search box becomes the entry point for everyone (operators get search for the first time). **Cmd/Ctrl+K** focuses it and opens the palette.
- Typing shows a palette: recent searches and suggestions when empty, otherwise the top results grouped by type, keyboard driven. **Enter** on a highlighted result opens it; **Enter** with nothing highlighted, or "See all results", opens `/search?q=...`.
- `/search` is the full results page: type tabs with counts, filters, sort, rich cards with inline actions, empty / loading / error states. Operators get a simplified version (bigger cards, one primary action, no filters).
- The Live Floor's bottom `LocateBox` is replaced by the same service (its robot / station / trip search keeps working through the palette).
- Per-page search boxes (Robots, Master Data, Users, Maps, Request Material...) stay: they filter a table, they do not search the app.

## 2. Architecture

```
src/features/search/
  types.ts            SearchableEntity, SearchQuery, SearchContext, SearchResult, SearchProvider, Suggestion, SearchAction
  registry.ts         SearchRegistry: register(entity), providersFor(ctx)
  service.ts          SearchService: fan-out, merge, rank, group, cache, cancel stale
  match/              normalize.ts (case, diacritics), aliases.ts (ONE alias map), ids.ts (ID-pattern detection), scorer.ts (MiniSearch wrapper)
  context.ts          builds SearchContext from the signed-in user (role / permissions / fleets / locale / site)
  analytics.ts        placeholder `track(event)` over the platform logger
  recent.ts           recent searches per person (device service)
  entities/           ONE file per entity: robots.ts, trips.ts, workflows.ts, stations.ts, zones.ts, materials.ts, pages.ts, ...
  ui/                 SearchPalette, SearchResultsPage, ResultCard (+ per-type card bodies), ActionsMenu, FilterBar, TypeTabs, EmptyState usage
  index.ts            public entry (palette, route element, openSearch, useSearch)
```
Dependency rule: `search` may import other features **only through their `index.ts`**; no feature imports `search` except the shell (palette mount) and `AppRoot` (route). Entities read data through each owning feature's public entry (new tiny exports are added where missing, listed in section 8).

### Provider and registry

```ts
interface SearchProvider<T extends SearchableEntity> {
  type: EntityType;
  search(q: SearchQuery, ctx: SearchContext): Promise<SearchResultPage<T>>;
  suggest?(prefix: string, ctx: SearchContext): Promise<Suggestion[]>;
}
interface SearchEntityRegistration<T> {           // the ONE file per entity
  type: EntityType;  label: () => string;  icon: Icon;
  permission: (ctx) => boolean;                   // checked in the SERVICE before the provider runs
  load: (ctx) => T[] | Promise<T[]>;              // where its data comes from (a store today, an API later)
  fields: { name: keyof T | ((t:T)=>string); weight: number }[];
  idField: (t: T) => string;                      // exact-ID boost, ID-pattern detection
  toResult: (t: T, ctx) => SearchResult;          // title, subtitle, metadata, url
  actions: (t: T, ctx) => SearchAction[];         // locate, open, order, cancel, charger...
  filters?: FilterDef[];                          // status, fleet, zone, date range ...
  live?: (t: T) => Observable-like                // robots / trips only
}
```
`createLocalProvider(registration)` turns a registration into a `SearchProvider` (MiniSearch index rebuilt only when the underlying store changes). A future REST provider implements the same interface for the same `type` and replaces it in the registry: no UI change.

### Service

`SearchService.search(query, ctx)`:
1. `registry.providersFor(ctx)`: only entities whose `permission(ctx)` is true (**filtering happens here, before any data is read**), further narrowed by `query.types`.
2. If the text looks like an ID (`TRP-001`, `AMR-007`, `STA-113`, `DCP-1001`, `R-07` via alias) the matching entity's exact lookup runs first and its result is pinned at the top (and `Enter` jumps straight to it).
3. Fan out in parallel, cancel stale requests (AbortSignal + a request counter), cache the last 20 queries per context for 30 s.
4. Merge, rank (below), group by type with counts, paginate per type (`cursor` = offset locally).
5. Return `{ groups[], total, tookMs, didYouMean? }`.

### Result shape (normalized)

`{ id, type, title, subtitle, metadata: {label, value, tone?}[], highlights: {field, ranges[]}[], url, actions: SearchAction[], score, live?: {...} }`.
`SearchAction = { id, label, icon, kind: 'navigate'|'command', permission?, confirm?: ConfirmSpec, run(ctx) }`. State-changing actions (`cancel trip`, `send to charger`) carry `confirm` and go through the app's `ConfirmDialog`.

## 3. Matching and ranking

- **Library: MiniSearch** (about 6 KB, no dependency). Fuzzy (edit distance 1, 2 for terms over 6 chars), prefix, per-field boost, custom tokenizer, diacritic-insensitive, fast to build and query for thousands of records. Fuse.js is slower and its prefix matching is weaker. If a dependency is unwelcome the fallback is a ~150-line scorer; I recommend the library.
- **Normalization:** lower case, NFKD without marks, punctuation to spaces, number words to digits ("line three" = "line 3"), `line`/`bay` short forms (reusing the idea of `ati-ai/service/fuzzy.ts`, which moves into `match/` and is shared).
- **Aliases (one file, `match/aliases.ts`):** `amr = robot = bot = sherpa`, `l3 = line 3`, `trip = trp = journey`, `wf = workflow`, `stn = station`, `r-07 = amr-007`, `ws = workstation`, `charger = charging dock = charge`. Applied to query and to indexed text.
- **Score** = field weight x match quality (exact > prefix > fuzzy) + boosts: exact ID match +100 and pinned; prefix on the title +20; recency (last 7 days, trips and tickets) up to +10; role relevance (the person's own workspace types +8, e.g. operators see materials and workflows first, supervisors robots and trips, configurators workflows and stations); live "attention" (a blocked / error robot) +4 so problems surface. Ties: title A to Z.
- **Types of match shown:** matched text is highlighted in the title and subtitle (`highlights` ranges).
- **Performance:** debounce 150 ms, local search target < 100 ms measured by `tookMs` (tested on 5,000 synthetic records), long lists virtualized, indexes rebuilt lazily on store change.

## 4. Role visibility (enforced in the search layer by `permission(ctx)` and by filtering the rows)

`ctx.can(perm)` is the existing `can(user, 'workspace.feature')`; fleet scope = `visibleLiveIds`.

| Entity | Permission required | Row filter |
|---|---|---|
| Pages and settings | the page's own `canOpen(path)` | none |
| Robots (live) | `supervisor.live-floor` **or** `operator.book-trip` | the person's fleets |
| Robots (registry) / Hardware | `configurator.robots` / `configurator.hardware` | none |
| Fleets | `configurator.fleets`, or any fleet in the person's scope | scope |
| Trips: live | `supervisor.live-floor` | scope |
| Trips: booked / requested | `operator.book-trip` | own only (`requestedBy` / `bookedBy`); approvers also see requests waiting on them |
| Stations, Zones (live map) | `supervisor.live-floor` or `operator.book-trip` (work stations only) | the fleet's lane map |
| Chargers | with Stations (type filter), supervisor + configurator only |
| Maps, Staging areas | `configurator.maps` / `configurator.master-data` | none |
| Workflows | `configurator.workflows` | none; **operators**: published, Tablet, their fleet, listed in Start (existing `visibleWorkflows`) |
| Materials | `configurator.master-data`; operators: `requestableItems` | operators: only what they may request |
| Users | `manageUsers` (configurators) | none |
| Report metrics | `supervisor.reports` | none |
| Action Center calls | `supervisor.action-center` / `operator.action-center` | scope |
| Notifications | any signed-in user | own list |
| Support tickets, help articles | everyone | own tickets |
| Integrations | `configurator.settings` | none |

An **operator can never receive** Users, Maps, Workflows they may not request, Integrations, Report metrics, other people's trips. This is covered by a test that runs every registered entity as each of the three workspaces and asserts no forbidden type or row appears.

## 5. Entities: phase map and what each needs

| Phase | Entities | Small changes needed in existing code |
|---|---|---|
| 1 | Robots (live), Trips (live + booked + requested), Pages / settings | `?focus=robot:AMR-003` on `/supervisor/livefloor` (applied once the scene is ready; replaces router state `locate`); a trip detail route `/operator/trips/:id` reusing `HistoryDetail`; export `canOpen` page list |
| 2 | Stations, Chargers, Zones, Workflows, Materials, Fleets, Registry robots, Hardware | `?focus=station:STA-113` / `zone:ID` on the Live Floor; `?code=DCP-1001` on Master Data (opens the row); `?station=` on the Map Editor |
| 3 | Maps, Staging areas, Users, Report metrics, Action Center calls, Notifications, Support tickets / help, Integrations, Firmware | `?metric=` on Reports, `?call=` on Action Center, `?ticket=` on the support window |
| 4 | Operator mode polish (large cards, one primary action, no filters) | none |

Not built, because the thing does not exist: alert / error-code fix steps (no catalogue yet), saved dashboards, audit log, workflow version history, schedules, forms, triggers, shifts. They register later with one file each.

## 6. Actions

Navigate actions: Open (detail page), Locate on map (`/supervisor/livefloor?focus=robot:ID`, same URL works shared), Show on map, Open config, Open in editor, View versions (maps), Order (opens Request Material with the item added to the cart: `?add=DCP-1001`), Run workflow (operator: the Book Trips card), View stock (Master Data row).
Commands: **Cancel trip / request** (own, while cancellable, existing rules, confirm dialog) and **Send to charger** (new, below). "Send a robot here" is **not built**.

### Send to charger (new floor command)
- Who: `supervisor.live-floor` (and configurators who hold it); the robot must be on the person's fleet scope, not offline / charging / in error, and **not carrying a load** (it may be on an empty return or parked; a loaded trip is refused with a reason: "AMR-003 is carrying a load for TRP-014").
- Port: optional `TelemetryAdapter.sendToCharger?(robotId): { ok: true; chargerId } | { ok: false; reason }` (documented in `core/types.ts`, section 5 of CLAUDE.md); a real fleet manager implements the same call.
- Simulator: `FleetSim.sendToCharger(id)` ends the robot's current empty / park leg at the next safe point, then gives it a `charge` trip to the nearest free charger of its fleet (the machinery for low-battery charge trips already exists). It reports `task.type = 'charge'`; the trip keeps the "a trip is never reassigned once started" rule: a robot that is already driving a work trip is refused, never re-planned.
- UI: the action opens the app's `ConfirmDialog` ("Send AMR-003 to a charger?"), then a toast with the charger id, or the refusal reason. Tests in `tests/sim` for accepted / refused cases (loaded, offline, charging).

## 7. UX details

- **Palette:** `role="combobox"` input with `aria-controls` the listbox, `aria-activedescendant`, groups as `role="group"` with labels, `aria-live="polite"` count announcement ("12 results, 3 robots"), Up / Down moves, Enter opens, Esc closes and restores focus, Tab moves to the actions of the highlighted result (Locate, Open, ...). Recent searches (max 8) and suggestions (e.g. type words, the person's most used pages, "Try: AMR-007, TRP-001, line 3") when the box is empty.
- **Results page:** `/search?q=&type=&fleet=&status=&zone=&sort=&from=&to=&cursor=` (all state in the URL). Tabs All / Robots / Trips / Workflows / Stations / Zones / Materials / Pages ... with counts (only the types the person can see). Cards per type (robot: status dot, battery, fleet, zone; trip: status, robot, from to, time; workflow: version, status, last edited; material: group, fleets, stock if known; page: path), highlighted matches, inline actions. Long lists virtualized; "Load more".
- **Live data:** robot and trip cards subscribe to `useApp.robots` while visible (one selector for the visible ids), updating status / battery / zone without re-running the search.
- **Operators:** the same page with `simple` mode: no filter bar, fewer tabs (Materials, Workflows, Stations, My trips), bigger targets (>= 48 px), one primary action per card ("Order", "Book trip"), plain labels.
- **Empty / zero results:** "No results for 'xyz'", did-you-mean (closest indexed term), suggestion chips, "Search help". Error state with Try again. Skeletons while loading (existing `Skeleton`).
- Chrome texts in all five catalogs (area `search`); entity data is never translated; page / setting labels are indexed in the person's language **and** English.

## 8. Backend readiness

- REST contract for a server provider: `GET /search?q=&types=robot,trip&filters[fleet]=&sort=&cursor=&limit=` returns `{ groups: [{ type, total, results: SearchResult[], nextCursor }], tookMs, didYouMean }`; `GET /search/suggest?prefix=`. Auth and **permissions are re-enforced server-side** (the client filter is a convenience, not a boundary: stated again in CLAUDE.md). Index candidates: Postgres full-text + trigram (small), Meilisearch / OpenSearch (large trip history). Plug-in point: `registry.register({ ...entity, provider: restProvider('trip') })`.
- Analytics: `track({ name: 'search' | 'zero_result' | 'result_click' | 'action_run', q, type, position, tookMs })` writes to the platform logger today and is the single place to connect an analytics tool.

## 9. Files touched outside `features/search`

- `shell/Topbar.tsx` / `AppShell.tsx`: the search input opens the palette (the three `getHits` functions and their `SearchHit` plumbing are removed; `liveHits`, `configuratorHits`, `operatorHits` deleted, `findTargets` kept only if the Live Floor still needs it, `LocateBox` replaced).
- `app/AppRoot.tsx`: lazy route `/search` inside each workspace layout (permission: any signed-in user; the page itself filters by role).
- `features/live-floor/LiveFloorPage.tsx`: read `?focus=`; `ui/locate.ts` stays the engine call.
- Small public exports and deep-link params listed in the phase map (Master Data, Map Editor, Reports, Action Center, support window).
- `core/types.ts` + `adapters/sim.ts` + `adapters/mock.ts` + `services/dummy/fleetFeed.ts`: `sendToCharger`.
- `package.json`: `minisearch`.
- i18n: area `search` in en / hi / kn / ml / ta.
- `CLAUDE.md`: new section; `docs/design/global-search.md` (this file) stays as the record.

## 10. Verification plan

Unit tests (`tests/search/*.test.ts`): ranking (exact ID beats fuzzy, prefix beats contains, recency and role boosts, field weights), fuzzy and diacritics, alias map (`L3`, `line three`, `R-07`, `AMR / robot / bot`), ID-pattern detection and pinning, **permission filtering for each workspace (an operator never sees configurator-only types or other people's trips)**, provider swap (a fake REST provider replaces a local one), cache and stale-request cancel, `tookMs` under 100 ms for 5,000 records. Sim tests for `sendToCharger`. e2e (`tests/e2e/search.spec.ts`): Cmd/Ctrl+K opens the palette; search a robot then Locate on map (URL `?focus=robot:AMR-003` flies the camera and survives a reload); search `TRP-001` then open and track; operator searches a material and orders it; configurator searches a workflow and opens it in the editor; zero results shows suggestions; operator mode; keyboard-only run through the palette; axe check on the palette and the page.

## 11. Risks and open points

- Client-side permission filtering is not a security boundary (no backend). Documented, and re-enforced when a server provider exists.
- Adding deep-link parameters touches six existing pages; each change is small and listed above, and each page keeps working without the parameter.
- The Live Floor must be mounted before a `?focus=` can move the camera; the parameter is applied after the scene reports ready, and cleared from the URL only if the person moves the view (so a reload still lands on the same thing).
- "Stock" for materials is not modelled in the app (Master Data has no stock levels): the material card shows group and fleets, not availability, until stock exists.
- The ERP material catalogue (128k generated rows) is **not** indexed; it keeps its own paged search in the import dialog.

## 12. As built (changes from the proposal above)

- **Operators do not search live robots** (the brief lists materials, workflows, stations and their own trips for them): `robot` needs `supervisor.live-floor`. Operators search: pages, trips (their own bookings and requests), stations (work stations), workflows and materials they may order (the Book trip rules), support. Their cards are simple: no filters, one button.
- **Built:** robots, trips (live / booked / requested), pages, stations (with chargers and parking for supervisors and configurators), zones, workflows, materials, fleets, registered robots and hardware, maps, users, report metrics, integrations, support tickets and help articles. **Not built:** notifications and Action Center calls (transient lists; one registration file each when wanted), and the entities that do not exist in the app (error-code fix steps, audit log, schedules, ...).
- **Deep links added:** `/supervisor/livefloor?focus=robot|station|zone|fleet:<id>`, `/operator/history?open=req:<id>|trip:<id>`, `/configurator/master-data/materials?code=`, `/operator/book?add=` (opens Request Material filtered to that material), `?support=ATI-1038` on any page. `/search?q=` redirects to the person's workspace (`/<workspace>/search`).
- **Send to charger:** in the robot window and as a search action; the simulator refuses a robot on a work trip, accepts an idle one now and one on an empty return / parking trip after that trip.
- **Not done:** the Live Floor's bottom `LocateBox` is kept (it is the map's own locate control: robot and station ids only); result lists are paged with "Show more" (20 at a time) instead of virtualised; "Send a robot here" is not built (operators use Book trip); cross-site and voice search are out of scope.
