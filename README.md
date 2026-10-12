# Ati Flow Prototype

A role-based web app for Ati Robotics AMR fleets, in two parts:

- **Supervisor:** a Dashboard (fleet at a glance) and a real-time 3D Live Floor. A client's CAD floor plan (DWG) becomes a Three.js scene you can orbit, pan, zoom and walk through, with robots driven by a telemetry feed (a built-in simulator for now).
- **Configurator:** Workflow Builder, Robots, Hardware, Master Data, Fleets and Maps pages for setting a site up.

Stack: Vite, TypeScript, React 19, vanilla Three.js, zustand, Tailwind v4 with Untitled UI components, vitest.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173 (also served on the LAN)
npm test         # vitest: nav, rules, simulator, auth, workflows, devices, master data, fleets
npm run build    # type check + production build
```

## Sign in

Prototype accounts live in `src/features/auth/users.ts` (plain text on purpose, no real backend):

| username | role | lands on |
|---|---|---|
| arjun | supervisor | `/supervisor/dashboard` (or the page they left) |
| kavin, meera | configurator | `/configurator` (Workflow Builder) |

Each user returns to the page they last left after logging back in. Roles never see each other's pages.

## Where things are

```
src/app/         route table, role guards, last-page memory
src/features/    auth, live-floor, workflow-builder, devices (robots + hardware),
                 master-data, fleets, maps, configurator (shared sidebar)
src/shell/       sidebar, top bar, user menu shared by every page
src/core/        pure TypeScript: types, lanes, rules, store (no DOM, no Three)
src/engine/      Three.js scene, cameras, robots, rules overlay
src/adapters/    telemetry adapters (mock simulator today)
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

- Data in the configurator (workflows, devices, master data, fleets) is saved per browser in `localStorage`; there is no backend, and Publish only shows a toast.
- No live telemetry yet: the WebSocket/REST adapters are not built.
- Features without a design show a "isn't part of this prototype" toast.

`CLAUDE.md` is the detailed architecture and decision log; read it before changing the system.
