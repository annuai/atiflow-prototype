# Architecture inventory (generated)
Files: 448 (388 ours, 60 Untitled UI library). Lines (ours): 34499.

## 1. Storage access outside the storage layer

Files touching local/session storage directly (everything except `src/data/storage.ts` should go through a `StorageBackend`): **11**
| file | uses |
|---|---|
| src/features/workflow-builder/model/store.ts | 8 |
| src/features/auth/authStore.ts | 6 |
| src/app/lastPage.ts | 2 |
| src/core/tripIds.ts | 2 |
| src/features/auth/userDirectory.ts | 2 |
| src/features/fleets/model/store.ts | 2 |
| src/features/live-floor/LiveFloorPage.tsx | 2 |
| src/features/maps/model/maps.ts | 2 |
| src/features/master-data/model/store.ts | 2 |
| src/features/preferences/data/store.ts | 2 |
| src/shell/AppShell.tsx | 2 |

## 2. Saved keys

| key | defined in |
|---|---|
| `atiflow.actioncenter.v1` | src/features/action-center/data/store.ts |
| `atiflow.bookings.v1` | src/features/bookings/model/schema.ts, src/features/bookings/model/store.ts |
| `atiflow.dataset.v1` | src/data/dataset.ts |
| `atiflow.fleets.v1` | src/features/fleets/model/store.ts |
| `atiflow.legendOpen` | src/features/live-floor/LiveFloorPage.tsx |
| `atiflow.mapnames.v1` | src/features/maps/model/maps.ts |
| `atiflow.mapversions.v1` | src/features/map-editor/model/store.ts |
| `atiflow.masterdata.v1` | src/features/master-data/model/store.ts |
| `atiflow.preferences.v1` | src/features/preferences/data/store.ts |
| `atiflow.requests.v1` | src/features/requests/model/store.ts |
| `atiflow.session` | src/features/auth/authStore.ts |
| `atiflow.settings.v1` | src/features/settings/data/store.ts |
| `atiflow.tripseq` | src/core/tripIds.ts |
| `atiflow.users.seedRevision` | src/features/auth/userDirectory.ts |
| `atiflow.users.v1` | src/features/auth/userDirectory.ts |
| `atiflow.workflows.v2` | src/features/workflow-builder/model/store.ts |
| `atiflow.workflows.v3` | src/features/workflow-builder/model/store.ts |
| `atiflow.workflows.v4` | src/features/workflow-builder/model/store.ts |
| `atiflow.workflows.v5` | src/features/workflow-builder/model/store.ts |
| `atiflow.workflows.v6` | src/features/workflow-builder/model/store.ts |
| `atiflow.workflows.v7` | src/features/workflow-builder/model/store.ts |
| `sb-collapsed` | src/shell/AppShell.tsx |

## 3. Layer imports (src/core, adapters, engine, ui, data, components, features)

| from \ to | adapters | app | assets | components | core | data | engine | features | main.tsx | platform | shell | ui | utils |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| adapters | 1 |  |  |  | 6 |  |  |  |  |  |  |  |  |
| app |  | 2 |  |  |  |  |  | 32 |  |  | 1 | 1 |  |
| components |  |  |  | 31 |  | 1 |  | 1 |  |  |  |  | 8 |
| core |  |  |  |  | 12 |  |  |  |  |  |  |  |  |
| data |  |  | 5 |  |  | 9 |  | 2 |  |  |  |  |  |
| engine |  |  |  |  | 9 | 2 | 6 |  |  |  |  |  |  |
| features | 2 |  | 1 | 326 | 49 | 44 | 2 | 895 |  | 1 | 5 | 62 | 37 |
| main.tsx |  | 1 |  |  |  |  |  |  |  | 1 |  |  |  |
| platform |  |  |  |  |  |  |  |  |  | 5 |  |  |  |
| shell |  |  |  | 14 |  |  |  | 8 |  | 1 | 15 | 4 |  |
| ui |  |  |  | 16 | 5 | 1 | 3 | 1 |  |  |  | 8 |  |

Breaks of the documented rule (core/adapters/engine import only core + data): **0**

## 4. Feature-to-feature imports (src/features/<a> -> src/features/<b>)

Distinct feature pairs: **72**, imports: **193** (deep imports into another feature's internals are the coupling to remove).
| pair | imports |
|---|---|
| fleets -> master-data | 13 |
| fleets -> devices | 12 |
| bookings -> requests | 10 |
| fleets -> workflow-builder | 9 |
| users -> auth | 7 |
| operator-history -> bookings | 6 |
| operator-history -> requests | 6 |
| users -> access | 6 |
| fleets -> maps | 5 |
| live-floor -> access | 5 |
| action-center -> requests | 4 |
| map-editor -> workflow-builder | 4 |
| master-data -> map-editor | 4 |
| requests -> auth | 4 |
| access -> auth | 3 |
| action-center -> access | 3 |
| action-center -> dashboard | 3 |
| auth -> access | 3 |
| bookings -> workflow-builder | 3 |
| configurator -> devices | 3 |
| map-editor -> maps | 3 |
| maps -> devices | 3 |
| master-data -> workflow-builder | 3 |
| notifications -> auth | 3 |
| notifications -> preferences | 3 |

## 5. Size and density

Files over 300 lines: **12**. Lines over 160 characters: **250** of 34499. Lines over 300 characters: **9**.
| largest files | lines | longest line |
|---|---|---|
| src/adapters/sim.ts | 1170 | 309 |
| src/engine/Engine.ts | 1166 | 238 |
| src/features/map-editor/MapEditorPage.tsx | 642 | 188 |
| src/features/map-editor/canvas/MapCanvas.tsx | 507 | 194 |
| src/features/workflow-builder/model/store.ts | 464 | 176 |
| src/core/lanes.ts | 449 | 253 |
| src/ui/Panels.tsx | 432 | 196 |
| src/features/bookings/BookTripPage.tsx | 357 | 248 |
| src/engine/robotMesh.ts | 326 | 218 |
| src/engine/rulesLayer.ts | 319 | 153 |
| src/features/workflow-builder/components/StationMap.tsx | 314 | 177 |
| src/features/workflow-builder/model/seed.ts | 309 | 219 |
| densest files (lines > 160 chars) | count |
|---|---|
| src/adapters/sim.ts | 25 |
| src/features/workflow-builder/assets/nodeIcons.tsx | 14 |
| src/core/lanes.ts | 7 |
| src/ui/icons/figma-icons.tsx | 6 |
| src/engine/Engine.ts | 5 |
| src/features/workflow-builder/model/seed.ts | 5 |
| src/features/map-editor/MapEditorPage.tsx | 4 |
| src/features/map-editor/help.ts | 4 |
| src/features/map-editor/model/roads.ts | 4 |
| src/components/map/laneArrows.ts | 3 |
| src/core/audit.ts | 3 |
| src/data/robotTypes.ts | 3 |

## 6. Hard-coded data and risky patterns (outside tests)

| pattern | occurrences | files |
|---|---|---|
| station ids (`STA-###`) | 34 | 7 |
| fleet names ("Line Side Fleet" / "Assembly Fleet") | 0 | 0 |
| `public/sites/` paths | 3 | 2 |
| plain-text passwords (`password:`) | 7 | 2 |
| `any` type | 9 | 3 |
| `eslint-disable` comments | 19 | 11 |
| `console.*` calls | 1 | 1 |
| `window.__` dev handles | 10 | 10 |
| `TODO` / `FIXME` | 0 | 0 |
| `setTimeout` / `setInterval` | 46 | 35 |

## 7. Stores (zustand) and where their state is saved

| file | persistence |
|---|---|
| src/core/store.ts | memory only |
| src/data/dataset.ts | StorageBackend |
| src/features/action-center/data/store.ts | StorageBackend |
| src/features/auth/authStore.ts | localStorage directly |
| src/features/auth/userDirectory.ts | StorageBackend |
| src/features/bookings/model/store.ts | StorageBackend |
| src/features/fleets/model/store.ts | localStorage directly |
| src/features/map-editor/model/store.ts | StorageBackend |
| src/features/maps/model/maps.ts | localStorage directly |
| src/features/master-data/import/job.ts | memory only |
| src/features/master-data/model/store.ts | localStorage directly |
| src/features/notifications/store.ts | StorageBackend |
| src/features/preferences/data/store.ts | localStorage directly |
| src/features/requests/model/store.ts | StorageBackend |
| src/features/settings/data/store.ts | StorageBackend |
| src/features/workflow-builder/model/store.ts | localStorage directly |
| src/shell/shellExtras.ts | memory only |
