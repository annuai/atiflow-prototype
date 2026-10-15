import { memo, useContext } from 'react';
import { notify } from '@/ui/toast';
import { MenuIcon_ } from './icons';
import { NODE_TYPES } from '../model/registry';
import { wfStore, useWorkflow } from '../model/store';
import type { WfNode } from '../model/types';
import { NodeIcon } from './icons';
import { XmarkIcon } from '../assets/nodeIcons';
import { FieldControl } from './FieldControl';
import { FlowCtx } from './FlowContext';

/** A workflow node card. Everything (fields, colours, width, note) comes from the registry entry of its type. */
export const NodeCard = memo(function NodeCard({ node, branch }: { node: WfNode; branch?: 't' | 'o' }) {
  const T = NODE_TYPES[node.t];
  const { startCardDrag } = useContext(FlowCtx);
  const sel = useWorkflow((s) => s.selected === node.id),
    fresh = useWorkflow((s) => s.justAdded === node.id);
  const cur = useWorkflow((s) => s.sim.currentId === node.id),
    vis = useWorkflow((s) => s.sim.visited.includes(node.id));
  const fields = T.fields.map((fd) => <FieldControl key={fd.key} node={node} spec={fd} inBranch={!!branch} />);
  return (
    <div
      className={[
        'wf-node',
        T.fixed ? 'wf-fixed' : '',
        node.t === 'logic' ? 'logic' : '',
        branch ? 'br-' + branch : '',
      ].join(' ')}
      data-node-id={node.id}
      data-sel={sel}
      data-fresh={fresh && !cur}
      data-cur={cur}
      data-vis={vis && !cur}
      style={{ width: branch && T.bw ? T.bw : T.w }}
      tabIndex={0}
      role="group"
      aria-label={T.label}
      onPointerDown={(e) => {
        if (!T.fixed) startCardDrag(e, node.id, e.currentTarget);
      }}
      onClick={() => wfStore.getState().select(node.id)}
    >
      <div className="wf-node-h">
        <div className="wf-node-t">
          <span className="ic" style={{ background: T.accent }}>
            <NodeIcon id={T.icon} size={12} />
          </span>
          <span>{T.label}</span>
        </div>
        <div className="wf-node-a">
          <button
            data-drag-handle
            disabled={T.fixed}
            aria-label="Drag to reorder"
            title={T.fixed ? undefined : 'Drag the card to reorder'}
          >
            <MenuIcon_ />
          </button>
          <button
            className="rm"
            aria-label={`Remove ${T.label}`}
            aria-disabled={T.fixed || undefined}
            title={T.fixed ? 'Every workflow needs this node' : 'Remove'}
            onClick={(e) => {
              e.stopPropagation();
              if (T.fixed)
                notify.warning(
                  `The ${T.label} can't be removed.`,
                  'Every workflow starts with a Start node and stops at an End node.',
                  'wf-problem',
                );
              else wfStore.getState().removeNode(node.id);
            }}
          >
            <XmarkIcon />
          </button>
        </div>
      </div>
      {node.t === 'logic' ? <div className="wf-lg-body">{fields}</div> : fields}
      {T.note && <div className={'wf-note' + (node.t === 'container' ? ' wrap' : '')}>{T.note}</div>}
    </div>
  );
});
