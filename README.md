# Ati Flow Prototype

A role-based web app for Ati Robotics AMR fleets, in three workspaces:

- **Supervisor:** a Dashboard (fleet at a glance) and a real-time 3D Live Floor. A client's CAD floor plan (DWG) becomes a Three.js scene you can orbit, pan, zoom and walk through, with robots driven by a telemetry feed (a built-in simulator for now).
- **Configurator:** Workflow Builder, Robots, Hardware, Master Data, Fleets, Maps (with a Map Editor), Users and Settings for setting a site up.
- **Operator:** a tablet UI to request material, book trips, approve requests and follow History.

Stack: Vite, TypeScript, React 19, vanilla Three.js, zustand, Tailwind v4 with Untitled UI components, vitest.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173 (also served on the LAN)
npm test         # vitest (unit and UI tests); npm run test:e2e runs the browser tests
npm run build    # type check + production build
npm run check    # everything CI runs: types, lint ratchet, import rules, format, tests
```

## Sign in

Prototype accounts are starting data in `src/fixtures/users.ts` (plain text on purpose, no real backend); the live list is edited on the Users page:

| username | role | lands on |
|---|---|---|
| arjun | supervisor | `/supervisor/dashboard` (or the page they left) |
| kavin, meera | configurator | `/configurator` (Workflow Builder) |
| rohan, sneha, vikram | operator | `/operator/book` |

Each user returns to the page they last left after logging back in. Roles never see each other's pages.

## Where things are

```
src/app/         route table, role guards, last-page memory
src/features/    one folder per feature (live-floor, dashboard, reports, workflow-builder,
                 devices, master-data, fleets, maps, map-editor, requests, bookings, ...)
src/shell/       layout, sidebar, top bar shared by every page
src/services/    ports (interfaces) and the dummy adapters behind them
src/core/        pure TypeScript: types, lanes, rules, store (no DOM, no Three)
src/engine/      Three.js scene, cameras, robots, rules overlay
src/adapters/    the fleet simulator (the dummy Fleet Manager)
src/components/  Untitled UI components and shared data / form / modal pieces
public/sites/    generated site data (site.json, nav.json) per site
tools/dwg-import/ Python importer: DWG -> site.json, nav.json
tests/           vitest suites
```

Layers stay separate: the renderer never knows about DWG, and the UI never knows about Three.js. Robot data reaches the app only through one telemetry schema, so a live feed means writing one adapter.

## Importing a new site

Needs `brew install libredwg` and a Python venv with `tools/dwg-import/requirements.txt`.

```bash
dwg2dxf -y -o layout.dxf "<client>.dwg"
python -I tools/dwg-import/import_dwg.py discover layout.dxf
python -I tools/dwg-import/import_dwg.py build tools/dwg-import/sites/<id>/import.config.yaml layout.dxf public/sites/<id> --preview
python -I tools/dwg-import/derive_lanes.py public/sites/<id>/site.json tools/dwg-import/sites/<id>/import.config.yaml public/sites/<id>/nav.json
```

Open a site with `?site=<id>`. The fleet areas, forbidden zones and traffic zones for the ECC site are sample data to replace with the client's real map rules.

## Current limits

- Data is saved per browser (localStorage / IndexedDB) through the service ports; there is no backend, and permissions are only enforced in the browser (`docs/architecture/authorization.md` lists what a server must enforce).
- No live telemetry yet: the WebSocket/REST adapters are not built.

`CLAUDE.md` is the detailed architecture and decision log; read it before changing the system.

## Engineering

Quality gates, import rules, runtime configuration (`public/config.json` and `VITE_*` variables), logging and error reporting are described in [`docs/architecture/foundations.md`](docs/architecture/foundations.md). The architecture audit and the plan for wiring real systems (Fleet Manager, Deployment Manager) are in [`docs/architecture/audit.md`](docs/architecture/audit.md); decisions are in [`docs/adr`](docs/adr). Deploy: it is a static single-page app; see [`docs/deploy.md`](docs/deploy.md) (Dockerfile with nginx, environment variables, headers, other hosts).

