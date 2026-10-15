# Architecture inventory (generated)
Files: 488 (428 ours, 60 Untitled UI library). Lines (ours): 36960.

## 1. Storage access outside the storage layer

Files touching local/session storage directly (everything except `src/data/storage.ts` should go through a `StorageBackend`): **0**
| file | uses |
|---|---|

## 2. Saved keys

| key | defined in |
|---|---|
| `atiflow.actioncenter.v1` | src/services/dummy/state.ts |
| `atiflow.bookings.v1` | src/features/bookings/model/schema.ts, src/services/dummy/bookings.ts |
| `atiflow.credentials.v1` | src/services/dummy/identity.ts |
| `atiflow.dataset.v1` | src/services/dummy/state.ts |
| `atiflow.fleets.v1` | src/services/dummy/state.ts |
| `atiflow.legendOpen` | src/features/live-floor/LiveFloorPage.tsx |
| `atiflow.mapnames.v1` | src/services/dummy/state.ts |
| `atiflow.mapversions.v1` | src/services/dummy/state.ts |
| `atiflow.masterdata.v1` | src/services/dummy/state.ts |
| `atiflow.preferences.v1` | src/services/dummy/state.ts |
| `atiflow.requests.v1` | src/features/requests/model/schema.ts, src/services/dummy/requests.ts |
| `atiflow.robotops.v1` | src/services/dummy/state.ts |
| `atiflow.session` | src/services/dummy/identity.ts |
| `atiflow.settings.v1` | src/services/dummy/state.ts |
| `atiflow.tripseq` | src/services/dummy/tripIds.ts |
| `atiflow.users.seedRevision` | src/services/dummy/identity.ts |
| `atiflow.users.v1` | src/services/dummy/identity.ts |
| `atiflow.workflows.v2` | src/services/dummy/workflows.ts |
| `atiflow.workflows.v3` | src/services/dummy/workflows.ts |
| `atiflow.workflows.v4` | src/services/dummy/workflows.ts |
| `atiflow.workflows.v5` | src/services/dummy/workflows.ts |
| `atiflow.workflows.v6` | src/services/dummy/workflows.ts |
| `atiflow.workflows.v7` | src/services/dummy/workflows.ts |
| `sb-collapsed` | src/shell/AppShell.tsx |

## 3. Layer imports (src/core, adapters, engine, ui, data, components, features)

| from \ to | adapters | app | assets | components | core | data | engine | features | fixtures | hooks | main.tsx | platform | services | shell | ui | utils |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| adapters | 1 |  |  |  | 4 | 2 |  |  |  |  |  |  |  |  |  |  |
| app |  | 2 |  |  |  |  |  | 33 |  |  |  |  | 1 | 1 | 1 |  |
| components |  |  |  | 32 |  | 1 |  | 1 |  |  |  |  |  |  |  | 9 |
| core |  |  |  |  | 12 |  |  |  |  |  |  |  |  |  |  |  |
| data |  |  | 5 |  |  | 11 |  | 2 |  |  |  |  | 2 |  |  |  |
| engine |  |  |  |  | 9 | 2 | 6 |  |  |  |  |  |  |  |  |  |
| features | 2 |  | 1 | 365 | 47 | 43 | 2 | 947 | 1 | 5 |  |  | 17 | 5 | 65 | 39 |
| fixtures |  |  |  |  |  |  |  | 3 | 3 |  |  |  |  |  |  |  |
| main.tsx |  | 1 |  |  |  |  |  |  |  |  |  | 1 | 1 |  |  |  |
| platform |  |  |  |  |  |  |  |  |  |  |  | 5 |  |  |  |  |
| services |  |  |  |  |  | 13 |  | 18 | 2 |  |  | 7 | 25 |  |  |  |
| shell |  |  |  | 14 |  |  |  | 8 |  |  |  | 1 | 1 | 15 | 4 |  |
| ui |  |  |  | 16 | 5 | 1 | 3 | 1 |  |  |  |  |  |  | 8 |  |

Breaks of the documented rule (core/adapters/engine import only core + data): **0**

## 4. Feature-to-feature imports (src/features/<a> -> src/features/<b>)

Distinct feature pairs: **75**, imports: **198** (deep imports into another feature's internals are the coupling to remove).
| pair | imports |
|---|---|
| fleets -> devices | 13 |
| fleets -> master-data | 13 |
| bookings -> requests | 10 |
| fleets -> workflow-builder | 10 |
| users -> auth | 7 |
| fleets -> maps | 6 |
| operator-history -> bookings | 6 |
| operator-history -> requests | 6 |
| users -> access | 6 |
| live-floor -> access | 5 |
| action-center -> requests | 4 |
| map-editor -> workflow-builder | 4 |
| master-data -> map-editor | 4 |
| requests -> auth | 4 |
| access -> auth | 3 |
| action-center -> access | 3 |
| action-center -> dashboard | 3 |
| bookings -> workflow-builder | 3 |
| configurator -> devices | 3 |
| map-editor -> maps | 3 |
| maps -> devices | 3 |
| master-data -> workflow-builder | 3 |
| notifications -> auth | 3 |
| notifications -> preferences | 3 |
| action-center -> live-floor | 2 |

## 5. Size and density

Files over 300 lines: **12**. Lines over 160 characters: **294** of 36960. Lines over 300 characters: **9**.
| largest files | lines | longest line |
|---|---|---|
| src/adapters/sim.ts | 1170 | 309 |
| src/engine/Engine.ts | 1166 | 238 |
| src/features/map-editor/MapEditorPage.tsx | 642 | 188 |
| src/features/map-editor/canvas/MapCanvas.tsx | 507 | 194 |
| src/core/lanes.ts | 449 | 253 |
| src/features/workflow-builder/model/store.ts | 447 | 176 |
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
| src/features/robot-ops/model/types.ts | 6 |
| src/ui/icons/figma-icons.tsx | 6 |
| src/engine/Engine.ts | 5 |
| src/features/workflow-builder/model/seed.ts | 5 |
| src/services/dummy/identity.ts | 5 |
| src/services/ports.ts | 5 |
| src/features/map-editor/MapEditorPage.tsx | 4 |
| src/features/map-editor/help.ts | 4 |
| src/features/map-editor/model/roads.ts | 4 |

## 6. Hard-coded data and risky patterns (outside tests)

| pattern | occurrences | files |
|---|---|---|
| station ids (`STA-###`) | 34 | 7 |
| fleet names ("Line Side Fleet" / "Assembly Fleet") | 0 | 0 |
| `public/sites/` paths | 3 | 2 |
| plain-text passwords (`password:`) | 1 | 1 |
| `any` type | 9 | 3 |
| `eslint-disable` comments | 19 | 11 |
| `console.*` calls | 1 | 1 |
| `window.__` dev handles | 10 | 10 |
| `TODO` / `FIXME` | 0 | 0 |
| `setTimeout` / `setInterval` | 48 | 37 |

## 7. Stores (zustand) and where their state is saved

| file | persistence |
|---|---|
| src/core/store.ts | memory only |
| src/data/dataset.ts | memory only |
| src/features/action-center/data/store.ts | memory only |
| src/features/auth/authStore.ts | memory only |
| src/features/auth/userDirectory.ts | memory only |
| src/features/bookings/model/store.ts | memory only |
| src/features/fleets/model/store.ts | memory only |
| src/features/map-editor/model/store.ts | memory only |
| src/features/maps/model/maps.ts | memory only |
| src/features/master-data/import/job.ts | memory only |
| src/features/master-data/model/store.ts | memory only |
| src/features/notifications/store.ts | memory only |
| src/features/preferences/data/store.ts | memory only |
| src/features/requests/model/store.ts | memory only |
| src/features/settings/data/store.ts | memory only |
| src/features/workflow-builder/model/store.ts | memory only |
| src/shell/shellExtras.ts | memory only |
