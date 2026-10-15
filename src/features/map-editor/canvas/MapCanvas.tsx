import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { laneArrowPath } from '@/components/map/laneArrows';
import type { SiteLayout } from '@/core/types';
import type { MapData, Selection } from '../model/types';
import { drawingPreview, floorPaths, pt, stagingGeometry, type P } from './layers';
import { DrawingLayer, LocatePulse, RoadHits, StagingLayer, StationLayer, ZoneLayer } from './layers/MapLayers';
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
  overlay,
  locate,
}: Props) {
  const vp = useViewport(site.bounds);
  const { P } = vp;
  const [hover, setHover] = useState<string | null>(null);
  const nodes = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes]);
  const pointer = usePointerTools({ vp, tool, editable, nodes: data.nodes, canSelect, onSelect, onPoint, onMove });
  const { mode, cursor } = pointer;

  // (the floor's paths depend on the bounds only, not on zoom: recomputed when the site changes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layers = useMemo(() => floorPaths(site, P), [site]);
  const lanes = useMemo(
    () => data.lanes.map((l) => 'M' + l.geom.map(([x, y]) => P(x, y)).join('L')).join(''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.lanes],
  );
  useEffect(() => {
    if (locate) vp.focusOn(locate.x, locate.y, locate.span);
  }, [locate?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  const arrows = useMemo(
    () => laneArrowPath(data.lanes, (x, y) => [vp.X(x), vp.Y(y)], vp.u),
    [data.lanes, vp.u, vp.X, vp.Y],
  );
  const roadLines = useMemo(
    () => data.roads.map((r) => ({ id: r.id, pts: r.points.map(([x, y]) => pt(vp, x, y)).join(' ') })),
    [data.roads, vp.X, vp.Y], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const staging = useMemo(
    () => stagingGeometry(data.stagingAreas, vp),
    [data.stagingAreas, vp.X, vp.Y], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const isSelected = (kind: string, id: string) => selection?.kind === kind && selection.id === id;
  const preview = drawingPreview(tool, drawing, cursor);
  const movable = editable && mode === 'none';
  return (
    <div
      ref={vp.box}
      className="relative size-full touch-none select-none overflow-hidden bg-[#f6f7f5]"
      data-no-pan
      onWheel={(e) => vp.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY)}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={vp.viewBox}
        role="img"
        aria-label="Map"
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
        <ZoneLayer zones={data.zones} vp={vp} isSelected={isSelected} />
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
          stations={data.stations}
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
