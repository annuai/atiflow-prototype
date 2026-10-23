import type { PointerEvent as ReactPointerEvent } from 'react';
import { cellRef } from '../../model/staging';
import type { stagingGeometry } from '../layers';
import { DirectionArrow } from './MapLayers';

type IsSelected = (kind: string, id: string) => boolean;
type DragStart = (e: ReactPointerEvent, kind: 'station' | 'staging', id: string, x: number, y: number) => void;
type DragEnd = (e: ReactPointerEvent) => void;

/** Staging areas: outline and cell grid; a draft's can be dragged. */
export function StagingLayer({
  staging,
  isSelected,
  cellsOf,
  onCells,
  onPickAt,
  movable,
  startDrag,
  endDrag,
}: {
  staging: ReturnType<typeof stagingGeometry>;
  isSelected: IsSelected;
  /** the cells picked inside a staging area (names like A1) */
  cellsOf(areaId: string): string[];
  /** a row number or a column letter was pressed: pick its cells (Shift adds them, or takes them out when all are picked) */
  onCells(areaId: string, refs: string[], shift: boolean): void;
  /** a press on the body of the selected area: pick the cell under the pointer */
  onPickAt(areaId: string, clientX: number, clientY: number, shift: boolean): void;
  /** the pointer shows "move" (a draft, no drawing tool) */
  movable: boolean;
  startDrag: DragStart;
  endDrag: DragEnd;
}) {
  return (
    <>
      {staging.map(({ a, u, cells, cellPaths, stations, letters, numbers, arrow, outline: o }) => (
        <g
          key={a.id}
          data-hit={`staging:${a.id}`}
          style={{ cursor: movable ? 'move' : 'pointer' }}
          onPointerDown={(e) => {
            if (!isSelected('staging', a.id)) return startDrag(e, 'staging', a.id, a.x, a.y);
            e.stopPropagation(); // the area is picked already: a press picks a cell (the grip in the middle moves the area)
            onPickAt(a.id, e.clientX, e.clientY, e.shiftKey);
          }}
          onPointerUp={endDrag}
        >
          <polygon
            points={o}
            fill="#e0f2fe"
            fillOpacity={isSelected('staging', a.id) ? 0.95 : 0.7}
            stroke={isSelected('staging', a.id) ? '#0284c7' : '#7dd3fc'}
            strokeWidth={isSelected('staging', a.id) ? 2.2 : 1.4}
            vectorEffect="non-scaling-stroke"
            data-hit={`staging:${a.id}`}
          />
          <path
            d={cells}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={0.8}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
          <path
            d={stations}
            fill="none"
            stroke="#0284c7"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
          {cellsOf(a.id).length > 0 && (
            <path
              d={cellsOf(a.id)
                .map((ref) => cellPaths[ref])
                .join('')}
              fill="#38bdf8"
              fillOpacity={0.35}
              stroke="#0284c7"
              strokeWidth={2.4}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
              data-testid="picked-cells"
            />
          )}
          {isSelected('staging', a.id) && (
            <g fontSize={20 * u} fontWeight={600} fill="#0369a1" textAnchor="middle" dominantBaseline="central">
              {letters.map((l) => (
                <g
                  key={'c' + l.text}
                  data-testid={`pick-col-${l.text}`}
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onCells(
                      a.id,
                      Array.from({ length: a.rows }, (_, i) => cellRef(i + 1, l.col)),
                      e.shiftKey,
                    );
                  }}
                >
                  <circle cx={l.x} cy={l.y} r={14 * u} fill="transparent" />
                  <text x={l.x} y={l.y} pointerEvents="none">
                    {l.text}
                  </text>
                </g>
              ))}
              {numbers.map((l) => (
                <g
                  key={'r' + l.text}
                  data-testid={`pick-row-${l.text}`}
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onCells(
                      a.id,
                      Array.from({ length: a.cols }, (_, i) => cellRef(l.row, i + 1)),
                      e.shiftKey,
                    );
                  }}
                >
                  <circle cx={l.x} cy={l.y} r={14 * u} fill="transparent" />
                  <text x={l.x} y={l.y} pointerEvents="none">
                    {l.text}
                  </text>
                </g>
              ))}
              <g pointerEvents="none">
                <DirectionArrow tail={arrow.tail} tip={arrow.tip} u={u} />
              </g>
            </g>
          )}
          <title>{`${a.name} · ${a.rows} x ${a.cols}`}</title>
        </g>
      ))}
    </>
  );
}
