import { areaFromRect, stagingRect } from '../../model/staging';
import type { MapData, MapZone, Selection, StagingAreaDef, ZoneShape } from '../../model/types';
import type { useViewport } from '../useViewport';
import { ZoneHandles } from './ZoneHandles';

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
