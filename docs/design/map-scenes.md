# Map scenes: loading each fleet's map into memory (system-level design)

Status: **decided; phases 1 and 2 built.** Starting point: commit `39087a2` (the world is built from fleets and their maps) plus the finding below.

**Decisions (user):** SceneManager from the start; "All fleets" = every map side by side at its placement; publishing keeps the old network running until the floor restarts; the two ECC fleets share one geometry layer; budget of 3 loaded scenes. Built: phase 1 (`src/core/scene/*`: `SceneModel`, `geometryKey`, `networkKey`, `sliceNetwork`, `sceneIndexes`; `World.scenes`, `world/scenes.ts` `sceneOfFleet` / `visibleScenes`) and phase 2 (`src/engine/SceneRenderer.ts`: `renderScene` -> one group + `dispose()`; `Engine.load` uses it, behaviour unchanged). Next: phase 3 (`SceneManager`, robots in scene groups), phase 4 (placement stored, "All fleets" side by side), phase 5 (prefetch, publish-in-place, e2e).

## 1. What is wrong today

Every fleet has its own map, but the Live Floor shows ONE merged scene. `Engine.load(site, nav)` runs once, adds everything to the single Three.js scene (no handle kept to remove it), and a fleet switch only calls `applyFilter`, which hides robots, lanes and pins that belong to other fleets. So:
- switching from Assembly Fleet to Line Side Fleet loads nothing: it is a visibility toggle on the same meshes;
- a fleet on a different building (an imported map) is far away on the merged floor and the camera does not go there;
- nothing is ever unloaded, and nothing can be: there is no unit of "a map that is loaded".

The tempting patch is to rebuild the whole `Engine` when the fleet changes (I started it). It works but costs a visible hitch (renderer, shader compile, every mesh again), loses camera and selection, and cannot show two maps at once. It is a stopgap, not the design.

## 2. The idea: a scene is a map version, loaded once, kept while it is cheap, disposed when it is not

Terms (one meaning each):
- **Map version**: an immutable published `MapData` (`mapId` + version number). Immutable means it can be cached by key and never needs invalidating, only replacing by a newer version.
- **Geometry layer**: the building: walls, machines, floor, bounds. It comes from `site.json` (ECC) or from an imported map's structure / DWG. It is **content addressed** (hash of the geometry), so two maps of the same building share one loaded copy.
- **Network layer**: what robots drive on and what the supervisor reads: nodes, lanes, stations, traffic gates, no-go zones, areas. One per map version.
- **Scene** = geometry layer + network layer + their derived indexes + their GPU resources, under one `THREE.Group`.
- **World** (exists, `buildWorld`) = the simulation view: every running map merged, because robots of different fleets meet in shared areas and the rules checker needs all of it. The world is for **simulating and checking**; scenes are for **showing**. They are built from the same inputs but are different things, and the design keeps them apart.

This answers "it might look the same but must reload": two ECC fleets look alike because they share the *geometry layer*; their *network layers* are different loads. Switching reloads only what differs.

## 3. Layers and who owns what

```
core/       pure, no Three, no React
  scene/model.ts        SceneModel = { key, geometry: GeometryLayer, network: NetworkLayer, bounds, placement }
  scene/build.ts        sceneModelOf(mapVersion, geometrySource, placement)  (pure, tested)
  scene/index.ts        derived indexes per scene: LaneGraph, RulesIndex, CollisionWorld (built lazily, cached with the model)
features/live-floor/world/   buildWorld (exists): fleets + maps -> World (simulation) AND the list of SceneModels it needs
engine/     Three only
  SceneRenderer.ts      model -> THREE.Group + disposables  (what Engine.load does today, extracted; returns a handle)
  SceneManager.ts       cache of loaded scenes: load(model), show(keys), evict(key), dispose(); LRU; per-scene camera memory
  Engine.ts             renderer, camera, controls, picking, robots; talks to SceneManager, not to the model data
features/live-floor/   page: chooses which scenes to show (a fleet's map, or all), shows progress and the "fleet is not on the floor" notice
```
Dependency rule is unchanged: `engine -> core`, `ui/features -> core`, nothing in `core` imports Three. `Engine` stops reading `nav` directly: it asks the active scene(s).

## 4. Loading, showing, unloading

- **`SceneManager.ensure(model)`** builds the group once per scene key (geometry layer reused if its content hash is already loaded) and keeps it. Building is chunked (walls, then machines, then labels) so a big map does not freeze the page, with a progress callback for the skeleton.
- **Showing** is cheap: toggling `group.visible` and flying the camera to that scene's bounds. After the first load, switching fleets is instant, which is what "reloaded to memory" should feel like.
- **"All fleets"** = every loaded scene visible at once, each at its own **placement** in the site frame (section 6). No special merged scene: it is the same scenes side by side.
- **Eviction**: scenes are kept up to a budget (default 3 loaded; memory estimate = instance counts + texture bytes). Past it, the least recently shown scene is **disposed** (geometries, materials, textures, labels), and rebuilt on demand. Disposal is part of the contract: `SceneRenderer` returns every disposable it created, and a test counts them.
- **Prefetch**: after the first paint, build the other visible fleets' scenes in idle time, so the first switch is already instant.
- **Imported map pictures** (the lidar floor image) are loaded from `mapAssets` into one texture per scene at the zoom level the camera needs, and are part of that scene's disposables.

## 5. Robots and selection belong to a scene

Robot meshes are attached to the group of the scene their fleet runs on. Hiding a scene hides its robots without any per-robot filter (`applyFilter` is gone, or reduced to "hide a fleet inside a shared scene"). A robot that changes fleet or map moves groups. Selection (robot, station, zone) is cleared only when its scene is evicted, not when you switch away and back. **Camera pose is remembered per scene**, so returning to a fleet returns to where you were. The plan (2D) view is still the same scene seen through a narrow lens: one load serves 2D and 3D.

## 6. Placement: one frame, stated once

Today the offset of an imported map is computed on the fly in `buildWorld` (laid out beside the others). That is the missing concept: **each map has a placement** in the site frame (`{x, y, rotation}`), stored with the map (default: automatic layout, editable later in the Map Editor header). All scene models, the simulator, the rules and every telemetry position use the site frame; a real fleet manager that reports in the map's own frame goes through its map's placement in the adapter, and nowhere else. Without this, two imported maps both have origin (0, 0) and the "All fleets" view cannot be right.

## 7. When something changes while the floor is open

| Change | What happens |
|---|---|
| A map version is published | A new scene key exists. Loaded scenes of the old key are replaced **in place** (new group built, swapped, old disposed); the camera stays. Robots on that map keep running on the old network until the next restart (see Q3). |
| A fleet is assigned another map | Its robots move to the other scene's group; the old scene is evicted if nobody else shows it. |
| A fleet is created / loses its map | World rebuilt (as now); no scene to load; the notice explains. |
| A DWG layer is saved | Only the geometry layer of that map changes (new content hash); the network layer is untouched. |

The signature in `buildWorld` becomes per scene (a hash of its model), so only changed scenes rebuild instead of the whole floor.

## 8. Alternatives considered

| | Rebuild the whole Engine on a fleet switch | **SceneManager with one group per map (proposed)** | One Engine per map (several canvases) |
|---|---|---|---|
| Switch cost | 0.2-0.8 s hitch every time | instant after the first load | instant |
| Camera, selection | lost | kept per scene | per canvas |
| "All fleets" | needs a merged scene (today's) | scenes side by side | impossible in one view |
| Memory | one scene | bounded by an LRU budget, disposal tested | one WebGL context per map (browsers cap contexts), duplicated renderer state |
| Effort | small | medium: extract `SceneRenderer`, add manager, move robots | large, wrong shape |

Rebuild-on-switch is a legitimate **first step** (it already gives correct content per fleet) and would be replaced, not extended, by the manager.

## 9. Decisions needed (they change the work)

1. **Approach:** SceneManager (proposed) from the start, or ship the quick rebuild-on-switch first and replace it?
2. **"All fleets" view:** every map side by side at its placement (proposed; needs placement stored), or require choosing a fleet when the maps are different buildings?
3. **Publishing while robots run:** keep driving the old network until the floor restarts (proposed: nothing jumps), or hot-swap the network (robots may be mid-lane on a lane that no longer exists)?
4. **ECC fleets:** both ECC fleets share the building. Share one geometry layer and load only the second fleet's network (proposed), or treat them as two independent scenes?
5. **Budget:** how many maps do you expect a site to run at once? It sets the default LRU size (3 assumed) and whether prefetch is on.

## 10. Phases (each verifiable on its own)

1. **Pure scene model + build + indexes** (`core/scene`), `sceneFor` slicing, tests: network layer of a fleet equals what the world holds for it; geometry hash shared by the two ECC maps; placement applied once.
2. **`SceneRenderer` extracted from `Engine.load`**, returning the group and its disposables; the Live Floor still loads one scene (no behaviour change). Test: dispose count matches creation count, nothing left in `scene.children`.
3. **`SceneManager`** (`ensure` / `show` / `evict`, LRU, per-scene camera), Live Floor switches fleets by showing scenes; robots attach to scene groups; `applyFilter` reduced.
4. **Placement stored** with the map + editable; "All fleets" = scenes side by side; adapter placement transform for real feeds.
5. **Prefetch, progress, publish-in-place**, and the e2e test: switch fleets, lane and station counts differ per map, camera returns, no leaked meshes after 20 switches.
