# Zone editing: rectangles, handles, directional line gates (design, not built yet)

## Decisions (from the user)
- Every zone is a **rotated rectangle** (traffic zones, box gates, no-go, work areas and every Zones-menu type). Existing polygons are converted by fitting the smallest rotated rectangle around them (never smaller than the old shape).
- **Line gate** = a box gate with a direction, drawn as ONE line with an arrow. The arrow marks the side the gate applies to: a robot approaching the line from that side waits until the gate's area is completely clear; robots approaching from the other side cross freely. **How far the area reaches** is a text input (depth, metres).
- Editing: click a zone, get body-drag, 8 resize handles, a rotate handle on a stick; sidebar has Centre X / Y, Width, Height, Rotation; arrow keys nudge, Delete removes, Ctrl+Z undoes (a drag is one undo step).

## Data (`map-editor/model/types.ts`)
```ts
type ZoneShape =
  | { kind: 'rect'; cx: number; cy: number; w: number; h: number; rot: number }          // metres, radians, rot 0 = +X
  | { kind: 'gate'; a: [number, number]; b: [number, number]; depth: number; side: 1 | -1 }; // the line a->b; side +1 = left of a->b
interface MapZone { id; type; name; props; shape: ZoneShape; polygon: [number, number][] /* DERIVED, kept for the simulator, engine, audit, thumbnails */ }
```
`model/shape.ts` (pure, tested): `polygonOf(shape)` (a gate = the line grown `depth` metres to its controlled side), `fitRect(polygon)` (min-area rotated rectangle: rotating calipers on the convex hull), `resizeRect(shape, handle, pointer, {keepAspect})` (the opposite corner / edge stays fixed), `rotateRect`, `moveShape`, `flipGate`. `normaliseData` gives every saved zone without a `shape` one (rect fit; a thin old line gate becomes a `gate` with depth 3 m). Only `shape` is edited; `polygon` is recomputed in the same step, so nothing else in the app changes shape.

## Canvas (`canvas/ZoneHandles.tsx`, screen-space like stations)
Only the selected zone of a DRAFT shows handles (published = read-only, no handles). Handle sizes are pixels (bigger with `isCoarse`). Body drag = move; corner / edge = resize (Shift keeps aspect ratio); stick handle = rotate (Shift snaps to 15 degrees). Gate: two end handles (move / lengthen the line), one body drag, a click on the arrow flips the side, a dashed outline shows the area. Pointer maths goes through `useViewport` (site coordinates), a drag is merged into one undo step with the existing `edit(key)` mechanism. Keyboard: arrows nudge 0.1 m (Shift 1 m), Delete removes.

## Sidebar (`ZoneForm`)
Rectangles: Centre X, Centre Y, Width, Height, Rotation (degrees), plus the type's own fields (capacity etc.). Line gate: Start X/Y, End X/Y (or length + rotation), **Depth (m)**, **Direction** (the arrow, with a Flip button), capacity. Numbers validated (positive size, depth > 0). New texts in all five languages, tooltips in `map-editor/help.ts`.

## Robots (the real change)
- Traffic zone / box gate: unchanged rule (one robot at a time), on the fitted rectangle.
- Line gate: the nav's `TrafficZone` gets an optional `gate: { a, b, depth, side }`. In `adapters/sim.ts` a robot asks for a gate's permit only when its path crosses the line from the controlled side; it is granted when no other robot is inside the rectangle (and none holds the permit); the hold point is outside, before the line. Robots crossing from the free side take no permit (their bodies still cannot overlap: the existing physical corridor check stays). `core/rules.ts` checks the same rule independently (a robot entering from the controlled side while another is inside = violation; the free side is never a violation). `engine/rulesLayer.ts` draws the line, the arrow and the dashed area.
- `applyPublishedMaps` copies `gate` and the rectangle polygon to the floor.

## Order of work
1. `shape.ts` + migration + tests (fit never shrinks, resize keeps the opposite corner, rotate about the centre).
2. Sidebar fields (works without handles).
3. Handles, keyboard, undo merging, touch sizes.
4. Line gate in the sim and the checker (+ benchmark: 12 seeds x 20 min, long waits must stay under 14%, zero violations).
5. Junction tool writes rectangles (`derive:zones`), i18n in 5 languages, e2e (drag, resize, rotate, flip, undo).

## Risks
- Fitting rectangles changes the simulator's zones (rotated rectangles are bigger than hulls at diagonal junctions): re-benchmark after step 1 and keep `margin` tunable.
- A stationary robot parked inside a larger rectangle blocks it (already a known limit); the editor should warn when a station lies inside a zone.
- Old saved versions and drafts are migrated on load; published versions keep their polygons through `shape`.

## Still to confirm
1. The arrow points to the side robots come FROM (the controlled side) and the area extends to that side of the line.
2. Default depth for a new line gate and for migrated thin gates: 3 m?
3. Existing saved drafts/versions: migrate in place (recommended) or keep old polygons read-only?
