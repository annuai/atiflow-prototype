# Architecture audit 2 (after phase 2 / 2b and the robot service pages)

Measured on 2026-10-15 at commit 5975e2a plus the working tree. Inventory numbers: `audit-data.md` (regenerate with `npm run audit:architecture`). Gates: typecheck, lint (0 errors, 72 warnings), import rules (0 new, 182 baselined), Prettier, 309 tests, build: all green.

## What is solid now
- **Layering is enforced, not described.** 0 import cycles; core / adapters / engine rules hold; `services` and `fixtures` have their own rules; only `services/` and `main.tsx` may touch dummy adapters.
- **All persistence goes through ports** (no `localStorage` outside `services/` and `data/storage.ts`); saved data is schema-checked on read and never erased when invalid; credentials are separate from profiles.
- **Quality gates run in CI** and a ratchet stops lint and import debt from growing.
- **Robot service pages are the reference pattern**: pure model, hooks over one port, screens from design-system parts, all text in `copy.ts`, tested rules and a tested dummy adapter.

## Findings, most important first

### A. Must fix before a real API can be plugged in
1. **The ports are synchronous at the start, a real API is not.** `snapshot()` / `read()` return data immediately and every store reads them at import time; an HTTP adapter has nothing to return before its first fetch. `hydrateServices` is mentioned in the port docs but does not exist. Needed: a boot step (`await hydrateServices()` in `main.tsx` before the app module loads, filling each adapter's cache) or loading states in the stores. Without it phase 3 cannot start. *Effort: medium (one boot function + per-adapter `hydrate`; stores stay as they are).*
2. **Saves are fire-and-forget.** 16 places call `void services().x.save(...)`. With the dummy it never fails; with an API a failed save is silently lost and the screen shows data the server never accepted. Needed: one `persist` helper per store (queue, retry, rollback or an "unsaved" state, a toast on failure, `reportError`). *Effort: medium.*
3. **Documents are identified by NAME.** Fleets are keys by name in workflows, fleet profiles, materials, requests and devices (renames cascade through `renameFleet`); robots, hardware and workflows are looked up by name; stations are bare strings in workflow nodes. A real fleet / deployment API has ids. Needed: stable ids in the dataset, names as labels only. *Effort: large, best done per entity with migrations, fleets first.*
4. **Operation-shaped APIs are missing for most domains.** Only `robotOps` is shaped like an API (async, can fail). Everything else is "save the whole list". Phase 3 turns each into operations (create fleet, assign robot, publish workflow, publish map version...) once the contracts are known. *Effort: per domain, after the API docs.*
5. **Authorization is UI-only.** Roles, permissions and fleet scope hide things in the browser; the data still reaches it (documented). Real enforcement is server-side; the front end needs a session token flow (SSO) in `AuthService` / `SessionService` (today a username in storage). *Effort: depends on the identity provider.*

### B. Structural debt worth paying soon
6. **Feature coupling: 178 baselined deep imports** between features (top pairs: fleets -> master-data 13, fleets -> devices 13, fleets -> workflow-builder 10, bookings -> requests 10, users -> auth 7, operator-history -> bookings / requests 6 each). Only 7 of about 25 features have a public `index.ts`. Fix by giving each feature an `index.ts` and moving imports to it, then regenerating the baseline (it only shrinks). *Effort: small per feature, mechanical.*
7. **Singleton stores initialise at import time** (`services()` is read when a module loads), so the services must be installed before any feature module is imported (guaranteed only by `main.tsx`'s dynamic import) and tests cannot swap services after import. Needed: stores created by a factory from `Services` at boot (the composition root builds them), with hooks reading them from context. *Effort: large, do together with item 1 or after.*
8. **Starting data still lives in features** (seed workflows and their upgrade steps, master data, fleet profiles, settings, map seeds) instead of `src/fixtures`. Mechanical, touches many tests. *Effort: medium.*
9. **The live feed is not a port** (`FleetSim` in the page is the dummy Fleet Manager behind `TelemetryAdapter`). Its contract (telemetry, orders, events) is fine; the adapter selection by `dataMode` is not wired. *Effort: small now, real work in phase 3.*
10. **A vendored Untitled UI file was edited** (`tabs.tsx`, for the gliding tab line): a re-install overwrites it (listed in CLAUDE.md section 61). Either keep a patch note per file or wrap the component in `components/` instead of editing it.

### C. Size, readability and tests
11. **Very large files:** `adapters/sim.ts` 1170 lines, `engine/Engine.ts` 1166, `map-editor/MapEditorPage.tsx` 642, `MapCanvas.tsx` 507, `core/lanes.ts` 449, `workflow-builder/model/store.ts` 447 (it still holds the version-upgrade code), `ui/Panels.tsx` 432. 12 files over 300 lines; 294 lines over 160 characters. Split along the seams already named in comments (sim: dispatch / permits / motion / events; Engine: camera / picking / touch / layers).
12. **Lint debt (72 warnings, all baselined):** react-hooks `refs` 25, `set-state-in-effect` 15, `exhaustive-deps` 10, `purity` 5, `max-lines` 7, `complexity` 4. Each is a real smell (state set inside effects, refs read during render); fix per file when touched, the ratchet keeps the count from rising.
13. **Tests cover logic well (309) and UI almost not at all.** No component tests, no end-to-end test, no accessibility check, no visual regression. The simulator tests take about 80 s of the suite. Needed: React Testing Library for the key flows (sign in, request / approve, edit configuration, publish map) and one Playwright smoke path in CI; split the slow simulation tests into a nightly job.
14. **Bundle:** the main route chunk (`AppRoot`) is 661 kB (pages are lazy, but stores, the notification, workflow and device models load up front), Reports 544 kB (charts), Live Floor 690 kB (three.js, expected). Needed: look at what `AppRoot` pulls in eagerly; `manualChunks` for vendor code.

### D. Accessibility and operations
15. **Untitled UI's `Dropdown.DotsButton` ignores a passed `aria-label`** (always "Open menu"), so every ⋮ menu (15+ on a page like Fleets) sounds identical to a screen reader. One-line fix in the vendored file, then pass real labels.
16. **No deployment package:** CI builds but nothing ships: no container / static-host config, no documented SPA fallback, no per-environment config template beyond `public/config.json`, no Content-Security-Policy, no release / version stamping beyond the config field. A short `docs/deploy.md` plus a Dockerfile (nginx with the fallback and headers) closes it.
17. **Observability is minimal:** logger and error reporter exist, the page boundary reports, but services do not log failures and there is no performance or usage telemetry hook.
18. **Dummy security smells to keep out of production:** plain-text seed passwords (`fixtures/users.ts`), sessions in `localStorage`, `window.__*` dev handles (all gated by `import.meta.env.DEV`: verified).

## Status (updated after the follow-up, CLAUDE.md section 62)
Done: 1 (start-up loading + boot failure screen), 2 (persisters with retry and a "not saved" notice), 6 (feature entries: baseline 182 -> 0), 8 partly (fixtures for dataset, fleet profiles, master data, settings, workflows), 9 (live feed port), 10 (vendored changes documented), 14 (vendor chunks), 15 (aria-label), 16 (Dockerfile, nginx, config at start, deploy docs; CSP report-only and untested), 13 started (jsdom tests for sign in, robot configuration, tabs, boot failure), 12 slightly (warnings 72 -> 67).
Open: 3 (ids), 4 (operation-shaped ports, needs the API contracts), 5 (server-side authorization), 7 (factory-built stores), 11 (big files), 13 (end-to-end and accessibility tests), 17 (observability), the rest of 12.

## Suggested order
1. Boot hydration (item 1) and a persist helper with failure handling (item 2): they unblock phase 3 and are contained.
2. Public `index.ts` per feature and shrink the 178 baselined imports (item 6), plus the quick wins 10, 15 and 16.
3. Stable ids, fleets first (item 3), then move fixtures (item 8) and factory-built stores (item 7).
4. Split the big files and add UI / end-to-end tests (items 11, 13) before the large refactors in 3, so they have a net.
5. Phase 3 adapters per domain when the Fleet Manager and Deployment Manager contracts exist (items 4, 5, 9).
