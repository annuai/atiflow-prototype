import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { laneArrowPath } from '@/components/map/laneArrows';
import type { SiteLayout } from '@/core/types';
import { text } from '../text';
import type { MapData, Selection, ZoneShape } from '../model/types';
import { drawingPreview, floorPaths, pt, stagingGeometry, type P } from './layers';
import { DrawingLayer, LocatePulse, RoadHits, StagingLayer, StationLayer, ZoneLayer } from './layers/MapLayers';
import { StationLink } from './layers/StationLink';
import { ZoomControls } from './layers/ZoomControls';
import type { Tool } from './tools';
import { usePointerTools } from './usePointerTools';
import { useViewport } from './useViewport';

interface Props {
  site: SiteLayout;
  data: MapData;
  tool: Tool;
  editable: boolean;
  selection: Selection;
  /** Which things the module can select (a click on anything else selects nothing). */ canSelect(
    sel: NonNullable<Selection>,
  ): boolean;
  onSelect(sel: Selection): void;
  /** The points of the shape being drawn so far, and a click while a drawing tool is active. */ drawing: P[];
  onPoint(p: P): void;
  onFinish(): void;
  /** Centre the view on a place and pulse it (a new `n` each time, so the same place can be shown again). */ locate?: {
    x: number;
    y: number;
    span: number;
    n: number;
  } | null;
  /** Drawn on top of the map inside its SVG (the simulation). */ overlay?: (
    vp: ReturnType<typeof useViewport>,
  ) => ReactNode;
  /** A station's heading is changed with its rotate handle (degrees, called while dragging). */ onStationAngle(
    id: string,
    degrees: number,
  ): void;
  /** A zone's shape is changed with its handles (called while dragging, with the new shape). */ onZoneShape(
    id: string,
    shape: ZoneShape,
  ): void;
  /** A station or staging area is dragged (called while dragging, with the new position). */ onMove(
    kind: 'station' | 'staging',
    id: string,
    to: { x: number; y: number },
  ): void;
}

/**
 * The map in the editor: the real floor, the map's own roads, zones, staging areas and stations, with the tools of the open module. Drag the floor to pan, wheel to zoom. Markers and labels keep
 * their pixel size when zooming. A click does what the tool says (select, place, add a point); a double-click finishes a road or zone; stations and staging areas of a draft can be dragged.
 * Pointer behaviour is `usePointerTools`, the drawing helpers are `layers.ts`, each kind of thing on the map is one component in `layers/`.
 */
export function MapCanvas({
  site,
  data,
  tool,
  editable,
  selection,
  canSelect,
  onSelect,
  drawing,
  onPoint,
  onFinish,
  onMove,
  onZoneShape,
  onStationAngle,
  overlay,
  locate,
}: Props) {
  const vp = useViewport(site.bounds);
  const { P, X, Y, u, attach: attachBox } = vp;
  const attach = useCallback((n: HTMLDivElement | null) => attachBox(n), [attachBox]);
  const [hover, setHover] = useState<string | null>(null);
  const nodes = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes]);
  const pointer = usePointerTools({ vp, tool, editable, nodes: data.nodes, canSelect, onSelect, onPoint, onMove });
  const { mode, cursor } = pointer;

  // (the floor's paths depend on the bounds only, not on zoom: P keeps its identity while the view moves)
  const layers = useMemo(() => floorPaths(site, P), [site, P]);
  const lanes = useMemo(
    () => data.lanes.map((l) => 'M' + l.geom.map(([x, y]) => P(x, y)).join('L')).join(''),
    [data.lanes, P],
  );
  useEffect(() => {
    if (locate) vp.focusOn(locate.x, locate.y, locate.span);
  }, [locate?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  const arrows = useMemo(() => laneArrowPath(data.lanes, (x, y) => [X(x), Y(y)], u), [data.lanes, u, X, Y]);
  const xy = useMemo(() => ({ X, Y, P }), [X, Y, P]);
  const roadLines = useMemo(
    () => data.roads.map((r) => ({ id: r.id, pts: r.points.map(([x, y]) => pt(xy, x, y)).join(' ') })),
    [data.roads, xy],
  );
  const staging = useMemo(() => stagingGeometry(data.stagingAreas, xy), [data.stagingAreas, xy]);

  const placedStations = data.stations.filter((s) => !s.unplaced); // those waiting for a position are listed in the panel, not piled on the origin
  const isSelected = (kind: string, id: string) => selection?.kind === kind && selection.id === id;
  const selectedZone = selection?.kind === 'zone' ? data.zones.find((z) => z.id === selection.id) : undefined;
  const preview = drawingPreview(tool, drawing, cursor);
  const movable = editable && mode === 'none';
  return (
    <div ref={attach} className="relative size-full touch-none select-none overflow-hidden bg-[#f6f7f5]" data-no-pan>
      <svg
        width="100%"
        height="100%"
        viewBox={vp.viewBox}
        role="img"
        aria-label={text.aria.map}
        className={mode !== 'none' && editable ? 'cursor-crosshair' : 'cursor-grab'}
        onPointerDown={pointer.down}
        onPointerMove={pointer.move}
        onPointerUp={pointer.up}
        onPointerCancel={pointer.up}
        onPointerLeave={pointer.leave}
        onDoubleClick={() => {
          if (mode === 'many' && editable) onFinish();
        }}
      >
        <path d={layers.grid} fill="none" stroke="#e5e7eb" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <path d={layers.floor} fill="#ffffff" stroke="#d4d4d8" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <ZoneLayer
          under={data}
          zones={data.zones}
          vp={vp}
          isSelected={isSelected}
          handles={selectedZone && { zone: selectedZone, editable, bodyDrag: mode === 'none', onShape: onZoneShape }}
        />
        <path d={layers.machines} fill="#d8dcd8" fillOpacity={0.75} pointerEvents="none" />
        <StagingLayer
          staging={staging}
          isSelected={isSelected}
          movable={movable}
          startDrag={pointer.startDrag}
          endDrag={pointer.endDrag}
        />
        <path
          d={lanes}
          fill="none"
          stroke="#14b8a6"
          strokeOpacity={0.5}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
        <path d={arrows} fill="#0f766e" fillOpacity={0.85} pointerEvents="none" />
        <RoadHits roads={roadLines} isSelected={isSelected} />
        <path
          d={layers.walls}
          fill="none"
          stroke="#52525b"
          strokeWidth={1.2}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
        <DrawingLayer
          preview={preview}
          drawing={drawing}
          cursor={cursor}
          active={mode !== 'none' && editable}
          vp={vp}
        />
        <StationLayer
          stations={placedStations}
          nodes={nodes}
          vp={vp}
          isSelected={isSelected}
          hover={hover}
          onHover={setHover}
          showLabels={vp.zoom >= 2.4}
          movable={movable}
          startDrag={pointer.startDrag}
          endDrag={pointer.endDrag}
        />
        <StationLink
          data={data}
          stationId={selection?.kind === 'station' ? selection.id : null}
          vp={vp}
          editable={editable}
          onAngle={onStationAngle}
        />
        <LocatePulse locate={locate} vp={vp} />
        {overlay?.(vp)}
      </svg>
      {cursor && (
        <span
          className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-primary/90 px-2 py-1 text-xs tabular-nums text-secondary shadow-xs ring-1 ring-secondary"
          aria-live="off"
        >
          X: {cursor[0].toFixed(2)} &nbsp; Y: {cursor[1].toFixed(2)}
        </span>
      )}
      <ZoomControls vp={vp} />
    </div>
  );
}
