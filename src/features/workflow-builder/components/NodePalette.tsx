import { useRef } from 'react';
import { PALETTE } from '../model/registry';
import { NODE_TYPES } from '../model/registry';
import { wfStore } from '../model/store';
import type { NodeTypeId } from '../model/types';
import { NodeIcon } from './icons';

/** Nodes menu (Figma "Nodes palette"). Mouse/pen: drag a tile onto a gap or click to append. Touch: tap to append (the palette scrolls). */
export function NodePalette({
  onTileDown,
}: {
  onTileDown: (e: React.PointerEvent, type: NodeTypeId | 'aiot', box: HTMLElement) => void;
}) {
  const handled = useRef(false);
  return (
    <div className="float wf-palette" data-no-pan data-wf-palette>
      <div className="ttl">Nodes</div>
      <div className="wf-tiles">
        {PALETTE.map((p) => {
          const bg = p.accent ?? NODE_TYPES[p.type as NodeTypeId].accent;
          const icon = p.icon ?? NODE_TYPES[p.type as NodeTypeId].icon;
          return (
            <button
              key={p.type}
              className="wf-tile"
              aria-label={`Add ${p.label} node`}
              onPointerDown={(e) => {
                if (e.pointerType !== 'touch' && p.type !== 'aiot') handled.current = true;
                onTileDown(e, p.type, e.currentTarget.querySelector('.box') as HTMLElement);
              }}
              onClick={() => {
                if (handled.current) {
                  handled.current = false;
                  return;
                }
                wfStore.getState().addNode(p.type);
              }}
            >
              <span className="box" style={{ background: bg }}>
                <NodeIcon id={icon} size={24} />
              </span>
              <span className="lbl">{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
