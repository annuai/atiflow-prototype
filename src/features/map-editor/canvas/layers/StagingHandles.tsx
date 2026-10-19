import { areaFromRect, cellCenter, clampCellAngle, cellHeading, stagingRect } from '../../model/staging';
import type { MapData, MapZone, Selection, StagingAreaDef, ZoneShape } from '../../model/types';
import type { useViewport } from '../useViewport';
import { ZoneHandles } from './ZoneHandles';

const norm = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

/**
 * The selected staging area of a draft: the same handles zones have, round its whole outline: drag the body to move it, eight handles to add or remove whole rows and columns (the cell size
 * stays), and the rotate handle to turn it. A grip in the middle shows where to take hold.
 */
export function StagingHandles({
  data,
  selection,
  enabled,
  vp,
  onChange,
}: {
  data: MapData;
  selection: Selection;
  /** a draft with the select tool: handles are shown for the selected area */
  enabled: boolean;
  vp: ReturnType<typeof useViewport>;
  onChange(id: string, patch: Partial<StagingAreaDef>): void;
}) {
  const area =
    enabled && selection?.kind === 'staging' ? data.stagingAreas.find((a) => a.id === selection.id) : undefined;
  if (!area) return null;
  const rect = stagingRect(area);
  const zone: MapZone = {
    id: area.id,
    type: 'area',
    name: area.name,
    shape: rect,
    polygon: [],
    props: {},
  };
  const cx = vp.X(rect.cx),
    cy = vp.Y(rect.cy);
  const mid = cellCenter(area, (area.rows + 1) / 2, (area.cols + 1) / 2);
  const hd = cellHeading(area);
  const len = Math.max(0.6, Math.min(area.cellLength, area.cellWidth) * 0.9);
  const tipX = vp.X(mid.x + (Math.cos(hd) * len) / 2),
    tipY = vp.Y(mid.y + (Math.sin(hd) * len) / 2);
  const turn = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const at = vp.toSite(ev.clientX, ev.clientY);
      let deg = (Math.atan2(at.y - mid.y, at.x - mid.x) * 180) / Math.PI - area.rotation;
      if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
      onChange(area.id, { cellAngle: clampCellAngle(Math.round(norm(deg) * 10) / 10) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <>
      <ZoneHandles
        zone={zone}
        vp={vp}
        editable
        bodyDrag
        onShape={(_, shape: ZoneShape) => {
          if (shape.kind === 'rect') onChange(area.id, areaFromRect(area, shape));
        }}
      />
      <circle
        data-handle="cell-angle"
        cx={tipX}
        cy={tipY}
        r={12 * vp.u}
        fill="#fff"
        stroke="#f97316"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        style={{ cursor: 'grab' }}
        onPointerDown={turn}
      />
      <g transform={`translate(${cx} ${cy}) scale(${vp.u})`} pointerEvents="none" aria-hidden>
        <circle r={11} fill="#fff" stroke="#0284c7" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        <path
          d="M0-6V6M-6 0H6M0-6l-2.4 2.4M0-6l2.4 2.4M0 6l-2.4-2.4M0 6l2.4-2.4M-6 0l2.4-2.4M-6 0l2.4 2.4M6 0l-2.4-2.4M6 0l-2.4 2.4"
          stroke="#0284c7"
          strokeWidth={1.4}
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </>
  );
}
