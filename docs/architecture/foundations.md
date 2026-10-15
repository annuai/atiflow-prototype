# Phase 1: foundations (tooling and platform seams)

Nothing here changes what the app does. It makes the code checkable and gives later phases somewhere to plug in. Run everything with `npm run check`.

## Quality gates (CI runs the same commands: `.github/workflows/ci.yml`)

| Command | What it checks | Rule |
|---|---|---|
| `npm run typecheck` | strict TypeScript over `src` and `tests` | must pass |
| `npm run lint:ratchet` | ESLint. **Errors** (unused code, rules of hooks, undefined names...) fail. **Warnings** are the house rules the old code does not meet yet (storage access outside the storage layer, `console`, `any`, files over 400 lines, high complexity, React Compiler style hook checks). | warnings may not grow: the allowed number per rule is in `lint.baseline.json`; after fixing some, `npm run lint:ratchet:update` locks the lower number in |
| `npm run check:imports` | dependency-cruiser layer rules (below) | a NEW violation fails; the 182 that existed on the day the rules started are in `.dependency-cruiser-known-violations.json` and only ever shrink (`npm run check:imports:baseline` regenerates it after you fix some) |
| `npm run format:check` | Prettier (`.prettierrc.json`, 120 columns) | must pass; `npm run format` fixes |
| `npm test` | vitest (unit tests of the pure logic, the simulator and the platform code) | must pass |
| `npm run audit:architecture` | prints an inventory (storage use, saved keys, layer and feature imports, density, hard-coded data) | information; `audit-data.md` is a saved copy |

The Untitled UI components in `src/components/base|application|foundations|shared-assets` are vendored library code: not linted or formatted by us.

## Import rules (`.dependency-cruiser.cjs`)

```
core/      plain TypeScript: no React, no Three.js, nothing from the layers above
adapters/  core + data only (telemetry sources)
engine/    the 3D engine: no React, no ui/features/shell/app
data/      shared dataset and storage: does not import features
components, ui, hooks, utils   shared building blocks: do not import features / shell / app
features/<a> never imports features/<b> internals: only <b>/index.ts   (178 old violations baselined)
features   never import app/ (the route table); no import cycles; src never imports dev dependencies
```

## Platform seams (`src/platform`, no React)

- **Runtime configuration** (`config.ts`): environment, release, `dataMode` (`dummy` or `api`), API base URLs (Fleet Manager, Deployment Manager, auth), feature flags, log level, error-reporting switch. Layers, lowest first: defaults, `VITE_*` build variables, `public/config.json` (served next to the app, so it can differ per environment without a rebuild). Validated with zod; a bad value is reported and ignored; the app always starts. `getConfig()` / `isFeatureEnabled('name')`. Loaded once in `main.tsx`.
- **Logging** (`logger.ts`): `log.child('feature')` with levels from the configuration; output goes to sinks (the console by default; a cloud logging service is another sink via `setLogSinks`). Use it instead of `console` (lint warns).
- **Error reporting** (`errorReporter.ts`): `reportError(error, { where })`; the page error screen and the global `error` / `unhandledrejection` handlers use it. The default reporter logs; a monitoring service is `setErrorReporter(...)` at start-up.
- **Schema-checked documents** (`createValidatedDocument` in `src/data/storage.ts`): a saved document is checked against a zod schema when read; older shapes go through `migrate`; anything unusable is reported and the seed is used WITHOUT erasing what was saved. This replaces the hand-written shape guards and per-store upgrade code, one domain at a time (first adopter: booked trips, `features/bookings/model/schema.ts`). The schema is also the draft of the API contract for that domain.

## Rules for new code

1. Do not read or write `localStorage` / `sessionStorage` directly: go through a `StorageBackend` (lint warns).
2. Do not call `console.*`: use `log`.
3. New configuration goes into `AppConfigSchema`, never a constant in a component.
4. A feature exposes what others may use from its `index.ts`; do not import another feature's internal files.
5. New saved data gets a zod schema and `createValidatedDocument`.
6. Keep lines under 120 columns (Prettier does it) and files under 400 lines (lint warns).

## Phase 2: service ports and dummy adapters (done)
`src/services/ports.ts` lists what the app asks of the outside world; `src/services/dummy` answers it from typed fixtures and browser storage; `src/services/index.ts` chooses per service from `dataMode`. Behind ports: users, auth (credentials separate from profiles), session, workflows, requests, bookings, trip ids, dataset, fleet profiles, master data, map names and versions, settings, preferences, notification cache, action log and per-device interface choices. Not behind a port: the live telemetry feed (it is the `TelemetryAdapter` contract already) and the starting data of some stores (still owned by their features). See CLAUDE.md section 59.
