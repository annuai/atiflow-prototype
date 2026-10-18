# Staging area cells hold materials: design

Status: PROPOSAL, nothing built yet. Written after reading the current Master Data staging code. Decisions that need the product owner are marked **Q1-Q6** (see the end).

## 1. What exists today

- A staging area is **defined on the map** (Map Editor): id `SA-001`, name, robot type, position/rotation, `rows x cols`, cell size. Master Data only reads the latest published version of the fleet's map (`master-data/model/mapAreas.ts`).
- Master Data stores the **state of each cell**, nothing else: `areas[].cells: Record<"row-col", 'reserved' | 'blocked' | 'filled'>` (missing key = available), saved in IndexedDB (`atiflow.masterdata.v1`).
- The grid (`CellGrid`) has View and Manage. In Manage a cell can only toggle **Available <-> Blocked**. Reserved and Filled are shown but cannot be set, and **nothing in the app sets them** (workflows, requests and the simulator do not touch cells). The seeded areas just carry demo states.
- So a "filled" cell does not say *what* it holds, and there is no way to put something in it.

## 2. What we want

A cell can hold a **material** (code + optional quantity). In Manage mode a person can fill a cell with a material, change the material, empty it, block it (with a reason) and release a reservation. People can see where a material is stored.

## 3. Data model

```ts
type CellState = 'available' | 'reserved' | 'blocked' | 'filled';   // unchanged: the existing state table stays the single source for labels, colours and rules

interface StagingCell {
  state: CellState;            // 'available' cells are not stored (a missing key = available)
  materialCode?: string;       // required for filled; for reserved = what it is held for; never on available / blocked
  quantity?: number;           // optional, whole number >= 1 (Q1)
  reason?: string;             // blocked: why (optional, free text)
  reservedFor?: string;        // reserved: the request / trip id that holds it (phase 2)
  updatedAt: number;           // ms
  updatedBy: string;           // username, or 'system' (phase 2: a workflow)
}
area.cells: Record<"row-col", StagingCell>
```

Invariants (one pure function `validateCell`, tested): filled needs a material that exists in Master Data; blocked and available carry no material; quantity only with a material; a material removed from Master Data leaves its cells filled but flagged "Unknown material" (never silently emptied).

**Storage / migration.** `atiflow.masterdata.v1` is bumped (v2): every old `cells[key] = 'filled'` becomes `{state:'filled', updatedBy:'system'}` WITHOUT a material (shown as "Material not set", counted as filled, fixed by the person) (Q5); `reserved` and `blocked` likewise. The loader upgrades old data in the same change (lesson from the requests page: a stored shape that gains a field needs a migration).

**Ownership stays as decided earlier:** areas (existence, size, position) belong to the Map Editor; Master Data owns the cell contents, keyed by area id so they survive new map versions; cells outside a smaller grid are hidden and publishing is blocked when Filled/Reserved cells (now with their materials) would go.

**Port.** Cell contents move behind a small service port `stagingCells` (`read(areaId)`, `set(areaId, key, cell | null)`, `setMany`, `subscribe`) with the dummy adapter on the existing IndexedDB document, so a warehouse system / the Fleet Manager can own this data later. The store is a thin cache over it.

## 4. Rules (pure, in `model/cells.ts`)

| From | To | Who | Needs |
|---|---|---|---|
| available | filled | person (Manage) | material (+ quantity) |
| filled | filled | person | change material or quantity |
| filled | available | person | confirm if quantity > 0 |
| any but reserved | blocked | person | optional reason |
| blocked | available | person | none |
| reserved | available | person ("Release reservation") | confirm, says who holds it |
| available / filled | reserved | **workflow / request (phase 2)** | trip id |
| reserved | filled / available | workflow when the trip drops / picks (phase 2) | |

- A material can only be put in a cell of an area whose fleet it is **assigned to** (the same list the workflow builder offers). Whether a cell can be dedicated to one material is **Q3**.
- Every change is **one history entry** (who, when, from -> to). History is shown per cell ("Activity" in the editor) and kept in the same document, capped (500, like the Action Center log). Needed because cells will later be changed by systems, and people will ask "who emptied this".
- A cell being edited by two tabs: last write wins per cell (cells are independent keys, so two people editing different cells never clash).

## 5. UI (Master Data > Staging Area, all Untitled UI parts)

- **Grid cells show the material.** The 52 px cell shows the first letters / a short code (`1003`), colour by state (unchanged), tooltip/aria label "B3 · Filled · DCP-1003 Chain Sprocket · 24 pcs". Empty = plain. Blocked shows a lock icon.
- **Manage mode: click a cell -> a side drawer / popover "Cell B3"** (not inline buttons): State (segmented: Available, Filled, Blocked), Material (Untitled `Select` with search, fleet's materials), Quantity (Input), Reason (blocked), **Save / Clear cell**, "Activity" list. Reserved cells open read-only with "Release reservation".
- **Select several cells** (Shift-click or drag a rectangle) -> action bar: *Fill with material...*, *Block*, *Clear*. One confirmation, one history entry per cell.
- **Find a material:** a "Material" filter above the grid highlights the cells holding it and dims the rest; the area card shows the count. Global search later returns "DCP-1003 is stored in SA-001: B3, C4".
- **Area card** keeps utilisation (filled / total) and adds a small breakdown ("5 materials"); legend unchanged.
- View mode stays read-only; hover/click opens the same drawer read-only (so "what is in B3?" works without Manage).
- Phones: the drawer becomes a bottom sheet; the grid scrolls sideways inside its card (as today).
- Texts in all five languages (catalog area `masterData.staging.cell*`), sentence case, per the standing rules.

## 6. Permissions

Editing needs `configurator.master-data` (same as the rest of Master Data). Operators and supervisors can *see* contents later (search, dashboard) but not edit. Phase 2 system changes are recorded as `updatedBy: 'system'`.

## 7. How it connects to the rest (phases)

1. **Phase 1 (this feature): manual contents.** Data model + migration, rules, editor drawer, bulk actions, material filter, history, tests. Nothing else in the app changes.
2. **Phase 2: workflows and requests use cells.** A material request with a "pick from staging area" step reserves a filled cell holding that material (oldest first), a drop-off step reserves/fills an available cell; completion updates the cell. The request screens show the cell (`SA-001 · B3`). Needs the cell <-> station link (a cell has a position via `cellCenter`; robots drive to the area's station) and the simulator learning the cell.
3. **Phase 3: a real warehouse system / Fleet Manager** owns cell contents through the `stagingCells` port.

## 8. Tests

- Pure: every transition in the table, invariants, quantity rules, migration of v1 data, unknown-material flag, history cap.
- Store: edit, bulk edit, area resize keeps hidden cells, material removal handling.
- Browser (Playwright): fill a cell, change its material, block with a reason, release, bulk fill, material filter highlights, persists after reload; phone viewport (drawer as a sheet, no horizontal overflow).
- i18n parity test covers the new texts.

## 9. Decisions (product owner, 2026-10-18)

- **Q1** a cell holds ONE material and a quantity (pieces).
- **Q2** build phases 1 AND 2 (manual contents, then requests and workflows reserve / fill cells).
- **Q3** no restrictions: any material assigned to the area's fleet can go in any cell.
- **Q5** the seeded demo Filled cells get real materials of their fleet (a `seedCells` fixture in `src/fixtures/masterData.ts`); old SAVED data without a material shows "Material not set".
- **Q4 and Q6 were not asked; the recommendations stand:** Reserved is set only by workflows / requests (a person can only release it); every cell keeps an activity log (capped at 500 entries per area).

## 10. Phase 2 in detail (how workflows and requests use cells)

Today a Material step names a material and the next Station steps say where the robot goes; nothing says *where in the area* the material is. Proposal:

1. **A Station step may point at a staging area** (the field offers the fleet's stations AND its staging areas, `SA-001 · Line Side Stage`). Everything else about the workflow stays.
2. **Pick-up at a staging area:** when a request is made, the system **reserves one filled cell holding the requested material** (oldest `updatedAt` first, enough quantity; a quantity larger than one cell takes several or is refused: see risk below). The request shows `SA-001 · B3`. If no cell holds it, the request is refused at once with "DCP-1003 is not in SA-001" (the same early refusal as today's "no robot of this type").
3. **Drop-off at a staging area:** reserves the nearest **available** cell (first free in row order); none free -> refused "SA-001 is full".
4. **Robot events change the cell:** pick-up done -> the source cell becomes available (or its quantity drops); drop done -> the target becomes filled with the material and quantity. Cancel / failure -> the reservation is released. All through one function `applyTripToCells(request, event)` (pure, tested) called by the request bridge; every change logged `updatedBy: 'system'` with the trip id.
5. **The robot drives to the area's station** (an area has one entry station chosen in the Map Editor: new field `stationId` on the area, required to publish an area that workflows use). The cell label is shown to the operator and in the Live Floor trip row; the simulated robot does not move differently inside the area.
6. **Search and dashboards:** global search finds "DCP-1003 · stored in SA-001 B3, C4"; the Materials dashboard can show stock per area (real numbers at last: the current "stock" insight was removed because Master Data held no stock).

**Risks / things to watch.** Reservation races (two requests for the last cell): reserve in one synchronous store action. Quantity vs cell capacity (does a cell have a maximum? default: none). A reload restarts the simulator while reservations persist: on start, `requeueOngoing` must also release reservations of trips that went back to waiting only if the request is cancelled. The map editor must refuse to delete an area that cells are reserved in (already refuses Filled / Reserved).

## 11. Build order

1. Model + rules + migration + seed (`model/cells.ts`, tests). 2. `stagingCells` port + dummy adapter, store as cache. 3. Cell editor drawer, bulk actions, material filter, activity, texts in five languages. 4. Browser tests (desktop + phone). 5. Phase 2: area `stationId` in the Map Editor, Station step offers areas, request reservation / completion (`applyTripToCells`), request screens show the cell, search. 6. Tests for the whole path (request -> reserve -> robot picks -> cell empties -> drop fills).

## 12. Retrieval order FIFO / LIFO (product owner, later the same day)

Each staging area has a **retrieval order**: FIFO (the material that has been in longest goes out first) or LIFO (the material put in last goes out first). Once set, **every request follows it**: nobody picks a cell by hand. **It is set as a dropdown in the Map Editor** (the staging area form, next to Sherpa type), so it belongs to the area definition (`StagingAreaDef.retrieval`, default FIFO, older maps get FIFO on load) and takes effect when the map version is published. Master Data only shows it (badge on the area card and header). The clock of the order is `StagingCell.storedAt` (when this material was put in; changing only the quantity does not restart it); equal times go row by row. `pickOrder` / `chooseCells` in `master-data/model/cells.ts` are the one implementation; the material filter in the grid numbers the cells in that order so the rule is visible.

## 13. Status

Phase 1 is built: cell model, rules, migration of old saved data, seeded materials, the cell editor with bulk edit, material filter with pick numbers, activity log, texts in five languages, Map Editor dropdown. Phase 2 (workflows and requests reserving and filling cells) follows. Deviation from section 3: cell contents stay inside the `masterData` document (a separate `stagingCells` port is not needed until a real system owns them).
