# Phase 0: architecture audit of Ati Flow (front end)

> Historical snapshot from before phase 1. The findings were fixed or are tracked in `audit-2.md` and CLAUDE.md sections 58-62 and 85-89; statements below such as "not built" describe that moment.

Scope: everything under `src/` (388 files we wrote, plus 60 files of Untitled UI library code). The findings below were measured **before** Prettier was applied (about 14,400 lines, 14% of them over 160 characters); `audit-data.md` is regenerated after formatting (about 34,500 lines, because the formatter splits the very long lines, which also shows the real size of the biggest files: `adapters/sim.ts` and `engine/Engine.ts` are each over 1,100 lines). The numbers come from `npm run audit:architecture` and can be regenerated at any time.

## 1. Verdict in one paragraph

The structure is better than the size suggests: the pure logic (`core/`, `adapters/`, the `model/` folders of each feature) has **no** React or Three.js imports, the layer rule in `CLAUDE.md` section 4 holds (0 violations), and there are already seams for swapping data sources (`StorageBackend`, `TelemetryAdapter`, `NotificationApi`, `MaterialSource`, `RunDataSource`). What is missing is **one consistent data layer**: every feature owns its store, its seed data, its saved key and its upgrade code, and several read browser storage directly. That is what makes it a prototype, and it is what phase 2 replaces. There is also a readability problem (very long lines) that is purely mechanical to fix.

## 2. Findings, most important first

| # | Finding | Evidence | Why it matters for production | Phase |
|---|---|---|---|---|
| 1 | **State, rules and persistence share one module.** A feature's zustand store holds the data, applies the business rules and writes to storage. | 17 stores; 11 files touch `localStorage` / `sessionStorage` directly (inventory §1, §7) | A real API cannot be swapped in without rewriting the store; rules cannot be reused on a server. | 2 |
| 2 | **22 saved keys, each with its own shape and hand-written upgrade code.** Workflows alone have 6 generations (`v2` to `v7`). | inventory §2 | No schema, no validation: stale or hand-edited data crashed pages several times; the page error screen is a safety net, not a fix. | 1 (infrastructure), 2 (per domain) |
| 3 | **Seed (dummy) data is spread over about 15 files and mixed with logic.** Station ids, users, passwords, sample workflows and the simulator's roster are defined next to the code that uses them. | 34 `STA-###` literals in 7 files; 7 plain-text passwords in 2 files (inventory §6) | The cloud team needs the dummy data in one replaceable place, not woven through features. | 2 |
| 4 | **Cross-feature coupling by deep imports.** | 72 feature pairs, 193 imports; heaviest: `fleets -> master-data` 13, `fleets -> devices` 12, `bookings -> requests` 10 (inventory §4) | Features cannot be moved, lazy-loaded or owned by a team independently; refactors ripple. | 1 (rule + baseline), 2 (public entry points) |
| 5 | **No runtime configuration.** Environment, data mode, API base URLs, feature flags and log level do not exist; paths and constants are in code. `public/config.json` is described in docs but not built. | 3 `public/sites/` paths in 2 files | A production build must be configured at deploy time without a rebuild. | 1 |
| 6 | **No error reporting or logging seam.** Errors go to the page error boundary and `console`; there is no port for a service such as Sentry. | 2 `console.*` calls; `PageErrorBoundary` only renders | Cannot observe real failures. | 1 |
| 7 | **No lint, format or CI.** Only `tsc` and `vitest` run, by hand. | no ESLint / Prettier config, no `.github/` | Nothing stops a regression or a layer violation from merging. | 1 |
| 8 | **Density.** 14% of lines were over 160 characters (203 over 300). Worst: `adapters/sim.ts`, `engine/Engine.ts`, `MapEditorPage.tsx`. | inventory §5 | Hard to review and to diff. **Fixed mechanically in phase 1 by Prettier** (now 250 long lines left, mostly strings and comments); what remains is size: 7 files over 400 lines (lint warns). | 1 (done), 4 (split the 7 big files) |
| 9 | **A data layer that points upward.** `src/data` imports types from `features/devices`. | `data/robots.ts`, `data/dataset.ts` | Inverts the dependency direction; the shared dataset should own its types. | 2 |
| 10 | **Credentials in client code and storage.** User passwords are in `features/auth/users.ts`; the Fleet Manager client secret is saved in plain local storage by Settings. | inventory §6 | Acceptable only because there is no backend; must be gone before real use. | 2 (auth port), 3 |
| 11 | **Browser-only simulator is the "fleet".** `adapters/sim.ts` runs in the page and the Live Floor, Dashboard, requests and bookings read it through `liveFeed.ts`. | `features/live-floor/liveFeed.ts` | Good seam already (`TelemetryAdapter` + orders), but the orders and trip-id counter are also owned by the page. | 3 |
| 12 | **Dependencies and tooling.** `npm audit` reports 2 vulnerabilities (1 moderate, 1 high) in the dev tooling chain; major versions are behind for vite, vitest, three, zustand, typescript. | `npm audit`, `npm outdated` | Plan upgrades after the gates are in place, not before. | 4 |

What is already in good shape (keep): layered folders; pure, tested `model/` code; single catalogs (robot types, access, zone types, help text); text kept in `copy.ts` files (a good start for translation); strict TypeScript; 274 tests.

## 3. Domain map: what each piece is today and where it plugs in later

`Port` is the interface the app should depend on (phase 2). `Dummy` is what implements it now (our existing seeds and stores, moved behind the port). `Real` is what a cloud team would provide.

| Domain | Today: store and key | Port (phase 2) | Dummy (now) | Real (later) |
|---|---|---|---|---|
| Sign-in, users, permissions | `auth/authStore` (`atiflow.session`), `auth/userDirectory` (`atiflow.users.v1`), seeds in `auth/users.ts` | `AuthService`, `UserService` | local directory + fixtures | company SSO (OIDC) and a user service |
| Fleets, robots, hardware | `data/dataset.ts` (`atiflow.dataset.v1`), `devices/model/store`, fleet profiles (`atiflow.fleets.v1`) | `FleetService` (configuration side) | `dataset.json` fixtures | **Fleet Manager** configuration API |
| Live robots, trips, orders | `adapters/sim.ts` + `live-floor/liveFeed.ts`, `core/store.ts`, `core/tripIds.ts` | `TelemetryService`, `OrderService` | simulator as a "dummy fleet manager" | **Fleet Manager** telemetry stream + order API |
| Maps, versions, stations, zones, staging areas | `maps/model/maps.ts` (names), `map-editor/model/store` (`atiflow.mapversions.v1`), `public/sites/*.json` | `MapService` | seeded from `site.json` + `nav.json` | **Deployment Manager** (builds fleets and maps) |
| Workflows | `workflow-builder/model/store` (`atiflow.workflows.v7`) | `WorkflowService` | seeds in `workflow-builder/model/seed.ts` | workflow service (Fleet / Deployment Manager) |
| Requests, approvals, booked trips | `requests/model/store` (`atiflow.requests.v1`), `bookings/model/store` (`atiflow.bookings.v1`) | `RequestService`, `BookingService` | local stores | Fleet Manager orders + an approvals service |
| Materials, stock | `master-data/model/store` (`atiflow.masterdata.v1`), `sources/mockCatalog.ts` | `MaterialService` | `mockCatalog` (128,872 generated rows) | ERP / MES |
| Notifications, alerts | `notifications/store`, `action-center/data/store` | `NotificationService` (exists as `NotificationApi`) | local sources | notification service / Fleet Manager events |
| Settings, preferences | `settings/data/store`, `preferences/data/store` | `SettingsService`, `PreferenceService` | local | settings service |

## 4. How the existing code can be reused for the real systems

- **Fleet Manager.** `core/types.ts` already defines the vendor-neutral contract (`RobotTelemetry`, `TransportOrder`, `OrderUpdate`, `FleetEvent`) and `TelemetryAdapter` with optional `submitOrder` / `cancelOrder` / `onOrderUpdate`. A real adapter maps the Fleet Manager's payloads to these and nothing above it changes. `core/rules.ts` (the independent rule checker), `core/measurements.ts` (KPI log) and `core/lanes.ts` (routing and route preview) work on any feed.
- **Deployment Manager.** The Map Editor's data model (`MapData`: nodes, lanes, roads, stations, staging areas, zones, with versions, draft and publish) is the editing side of what the Deployment Manager produces. A `MapService` adapter should read and write that shape; the importer in `tools/dwg-import` stays the offline path for a first map. The route, station and zone rules (`map-editor/model/validate.ts`) can run in the browser before a publish request is sent.
- **Pure logic that moves to a server unchanged:** access policy (`access/policy.ts`), request rules (`requests/model/rules.ts`), publish checks, lane routing, simulator rules. They have no browser dependencies.

## 5. What phase 1 changes (foundations, no behaviour change)

Lint (ESLint) and format (Prettier) with a ratchet so the existing code is tolerated but nothing new makes it worse; layer and import rules (dependency-cruiser) with a baseline of the 72 known feature couplings; runtime configuration and feature flags; error-reporting and logging ports; a schema layer (zod) for persisted documents; CI. See [`foundations.md`](./foundations.md).
