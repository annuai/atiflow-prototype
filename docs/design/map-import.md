# Map import (Deployment Manager map zip) — assessment and architecture

Status: **steps 1 and 2 built** (import, noise clean-up, review, draft map, wall / object extraction, 3D view, DWG overlay with auto-align, export back with an `ati_flow/` folder). Step 1 text follows. Original status: **step 1 built** (read a Deployment Manager zip, clean it, review, create a draft map, floor picture + path + stations in the Map Editor). Not built: export back to the Deployment Manager, DWG overlay, vector walls / 3D. Sample: `test_annuai.zip` (map `test_annuai`, version v5; a copy of its files is in `tests/fixtures/maps/`).

**Decisions (user):** (1) the sample is the only file for now, a better export will come: the importer is lenient (every file but `webui_map.json` is optional, unknown files are listed and kept, never an error). (2) The map must stay openable in the Deployment Manager: new files of ours go in their OWN folder inside the zip (`ati_flow/`), which the Deployment Manager ignores; existing files stay as they were, with station positions written back into `webui_map.json`. (3) 3D walls are wanted, from the grid AND from a client DWG laid over it for accuracy; noise clean-up is required. (4) The import dialog asks for the map version (v2 / v4 / v5) like Generate Map, preselected from `map_version` in `webui_map.json` (`yelli_meta.json` has a `version` 2.1 too: that is the lidar grid format, not the map version).

## 1. What the zip contains (measured)

| File | Size | What it is |
|---|---|---|
| `webui_map.json` | 17 KB | The web-UI map: `map_name`, `map_version`, `trip_type`, one `maps.0` image frame, **23 stations**. |
| `webui_map.png` | 260 KB, 1053x1357 | Low-resolution preview of the floor, with the mapping path drawn as a blue loop. UI backdrop only. |
| `yelli_map.npz` | 140 KB | **The real map**: one array `arr_0`, uint8, 3896 x 4065 cells, 15.8 MB raw. An occupancy grid (see 1.2). |
| `yelli_meta.json` | 205 B | Grid metadata: `grid_res` 0.02 m/cell, `map_origins [[1762, 2083]]` (origin cell), `num_lookup_levels` 20, `grid_lookup_type` odds, `beams`, `version` 2.1. |
| `yelli_poses.npy` | 7 KB | 289 x 3 float64 `(x, y, theta)` in metres/radians: the **robot's path while it mapped** (pose graph). |
| `yelli_frames.npy` | 2 KB | 289 int64 frame ids, one per pose. |
| `yelli_map.png` | 1.2 MB, 7176x5263 RGBA | The Deployment Manager's own render of the grid. Redundant: we can render from the npz. |
| `.DS_Store`, `__MACOSX/*` | | Mac junk; must be ignored. |

### 1.1 Coordinates
- **Origin**: `map_origins[0]` = cell (1762, 2083) of the grid, and `webui_map.json maps.0.origin` = pixel (296, 645) of the preview. Both are the (0, 0) of the metre frame (as you said, always present).
- **Verified transforms** (the mapping path lands inside the building and on the blue loop of the preview):
  - grid: `col = ox + x / 0.02`, `row = oy - y / 0.02` (x east, y north, row 0 at the top).
  - preview: `px = 296 + 31.488 * x`, `py = 645 - 31.488 * y` (`scale.y` is negative on purpose).
  - metre frame = our site frame (x east, y north, metres, theta CCW from +x). **No unit conversion, only a translation to the origin.**
- The poses span x -0.25..7.67 m, y -6.68..4.64 m; the occupied part of the grid is 2042 x 1427 cells (40.8 x 28.5 m) of 77.9 x 81.3 m, i.e. 18% of the grid holds the building and 99.2% of all cells are 0.

### 1.2 Stations
- 23 stations, ids 1..23, names "Station n". **All at x = 0, y = 0 = the origin: they have no real position yet** (they are placed later, in the Deployment Manager UI).
- Fields: `rotation`, `charging`, `inplace`, `clockwise`, `three_point_turn {enable, start_direction, start_action, aisle_width, aisle_length}`, `common_dispatch_station`, `post_process`, `station_tags` (`dispatch_not_reqd`, and `parking` on 21 of 23), `hidden`, `orientation`.
- **Not in this export: roads/lanes, zones, traffic gates, staging areas.** `webui_map.json` has only the image frame and stations, so the Deployment Manager keeps routes elsewhere (or this is a partial export).

## 2. Mapping onto our Map Editor

| Deployment Manager | Ours (`MapData`) |
|---|---|
| origin + `grid_res` | the site frame; origin = (0, 0) |
| occupancy grid | **new**: `MapData.base` (the floor image behind everything) |
| stations | `MapStation`: `id` -> `externalId`, `name`, `x, y`, `rotation` -> `angle`, `charging` -> type `charge`, tag `parking` -> type `park`, else `work` |
| poses | optional **mapping path** layer (a hint for drawing roads) |
| `three_point_turn`, `inplace`, `clockwise`, `post_process`, `common_dispatch_station`, `hidden`, `orientation`, other tags | kept verbatim in `MapStation.extra` so a later export back loses nothing |

Our own ids stay `STA-xxx`; the Deployment Manager id is kept as `externalId` for re-import and matching. A station at exactly (0, 0) is imported as **unplaced** (listed under "Needs placement", not drawn stacked on the origin, and Publish is blocked until each is placed), rather than putting 23 pins on one point.

## 3. Optimisation: what we never ship

The grid is the cost. 15.8 MB raw, but sparse and with only 19 levels.
1. **Never load the PNGs.** `yelli_map.png` (1.2 MB) and `webui_map.png` are previews; the npz is the source of truth and is already 140 KB.
2. **Parse in a Web Worker**, not the UI thread: zip (`fflate`, streaming, skips `__MACOSX` and dotfiles) -> `.npy` header parsed by hand (a 10-line reader: magic, version, header dict, dtype, shape; no numpy port needed) -> typed array.
3. **Crop to the occupied bounding box** (+ margin) while decoding: 3896x4065 becomes 2042x1427 here (-82% cells). The crop offset is stored so the origin transform stays exact.
4. **Convert odds to alpha once**: map the 20 levels to a black-to-transparent ramp (free = transparent), threshold the faint noise, write a **lossless WebP/PNG** (a sparse 8-bit mask compresses to roughly 100-200 KB). Never keep the raw grid in the browser after import.
5. **Mip pyramid at import** (0.02, 0.04, 0.08 m/cell, tiled at 512 px only if a map exceeds ~4k px): the SVG editor and the 3D floor pick the level from zoom, so a 100 m map stays smooth on a tablet.
6. **Draw it as one image** under the vector layers (SVG `<image>` in the Map Editor, one texture plane on the Live Floor). Do NOT vectorise by default.
7. **Optional later: vector walls.** Marching squares on the mask + Douglas-Peucker would give wall polylines that extrude in 3D like `site.json` walls. Valuable for the Live Floor, but noisy lidar (speckle, "ghost" walls outside the building in the preview) needs a clean-up step and a review screen; keep it a separate phase.
8. **Storage**: the image is a binary asset, not JSON. `MapData` stores only metadata + `assetId`; the blob goes through a new `mapAssets` service port (dummy = IndexedDB, content-addressed by SHA-256 so re-importing the same map costs nothing; real = object storage). The original zip is kept as an asset too (re-export, audit). `localStorage` must never hold images (5 MB limit, blocks the main thread).

Expected import cost for this map: 140 KB in, ~150 KB stored, a few hundred ms in the worker.

## 4. Architecture

```
src/features/map-import/
  formats/registry.ts        MapImporter { id, detect(entries), parse(entries) -> ImportedMap } (one file per format, like zone types)
  formats/deploymentManager/ detect (webui_map.json + yelli_map.npz), readNpy, readMeta, readStations, toImportedMap
  core/                      pure: ImportedMap, transforms (gridToMetre, metreToGrid), crop, oddsToMask, pyramid, stationMapping, validate  (no DOM, no React; unit-tested)
  worker/importWorker.ts     zip + npy + image encode off the main thread; progress + cancel messages
  ImportMapModal.tsx         existing dialog (maps feature) gets: drop zip -> progress -> REVIEW -> Import
  ReviewStep.tsx             preview with origin cross + station pins + mapping path; warnings; unplaced stations; name / fleet
src/services/ports.ts        mapAssets: put(blob) -> assetId, url(assetId), delete
src/features/map-editor/model/types.ts   MapData.base?: { assetId, res, originCell, cropOffset, size, levels[] }, MapData.path?: [x,y][]
src/features/map-editor/canvas/layers/   BaseImageLayer (picks the mip level by zoom), PathLayer
```
- **Review before commit:** the import never writes silently. The review shows what was found (map name, version, 23 stations, grid size, resolution, path length), what is missing (routes, zones), and problems (stations at the origin = unplaced, duplicate names, unknown tags, origin outside the grid). Warnings do not block; a missing/corrupt required file does (with a clear message).
- **Result = a new map with a first published version?** No: an imported map starts as a **draft** (stations unplaced, no roads), so nothing reaches the Live Floor until someone places stations, draws roads and publishes. The published-version rules of section 49 are unchanged.
- **Re-import (map changed in the Deployment Manager):** new base image and station list on a new draft of the same map; stations are matched by `externalId`, our placements and edits are kept, new ones appear unplaced, removed ones are flagged (not deleted), never silently overwriting.
- **Extensible:** a new source format = one importer file registered in `registry.ts`; `detect()` picks it by file names, so the user drops any zip. Other inputs (the DWG-derived sites, a plain PNG + origin/scale) are importers too.
- **Safety:** zip bomb limits (entry count, 50 MB per entry, 200 MB total uncompressed, grid up to ~16k x 16k cells), path traversal ignored (we never write to disk), dtype and shape whitelisted (`|u1` / `<f8` / `<i8`), JSON validated with zod.
- **Tests:** pure core with this zip as a fixture (shrunk copy) for: npy reader, transforms (origin cell maps to (0,0); a pose lands on the loop), crop, station mapping (unplaced, parking, charging), corrupt/oversize/missing-file errors; an e2e test for the dialog flow.

## 5. Open questions (answers change the design)
1. **Where do routes, zones and real station positions come from?** This export has none. Does the Deployment Manager have a second export (lanes/zones/gates) or are they only in its database? If a lane file exists we add it to the same importer.
2. **Should we export back** to this format (so a map edited here can be loaded into the Deployment Manager), or is import one-way? Round-trip needs the verbatim `extra` fields and the original zip.
3. **Vector walls for the 3D Live Floor now or later?** The image is enough for the editor and 2D; 3D walls need the clean-up phase (7 above).
