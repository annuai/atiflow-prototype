import { Fragment, useCallback, useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { notify } from '@/ui/toast';
import { useWorkflow } from '../model/store';
import type { WfNode } from '../model/types';
import { Connector } from './Connector';
import { FlowCtx } from './FlowContext';
import { NodeCard } from './NodeCard';
import { copy } from '../copy';

function Branch({ node, b }: { node: WfNode; b: 't' | 'o' }) {
  const list = node.br![b];
  const key = `${node.id}:${b}`;
  const taken = useWorkflow((s) => s.sim.taken[node.id]);
  return (
    <div className={`wf-lbranch ${b} ${taken ? (taken === b ? 'take' : 'skip') : ''}`}>
      <span className={`wf-pill ${b}`}>{b === 't' ? copy.branch.t : copy.branch.o}</span>
      <div className="wf-brow">
        {list.length === 0 ? (
          <button
            className="wf-empty"
            data-gap-list={key}
            data-gap-index={0}
            onClick={() => notify.info(copy.branch.hintTitle, copy.branch.hintBody, 'wf-branch')}
          >
            {copy.branch.drop}
          </button>
        ) : (
          <>
            <Connector listKey={key} gap={0} variant="ghost" />
            {list.map((x, i) => (
              <Fragment key={x.id}>
                <NodeCard node={x} branch={b} />
                <Connector listKey={key} gap={i + 1} variant={i === list.length - 1 ? 'ghost' : ''} />
              </Fragment>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/** If Logic: the condition card, two branch rows and the split/merge connector lines (drawn from live positions at any zoom). */
export function BranchGroup({ node }: { node: WfNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { zoom: z } = useContext(FlowCtx);
  const draw = useCallback(() => {
    const g = ref.current,
      svg = svgRef.current;
    if (!g || !svg) return;
    const G0 = g.getBoundingClientRect();
    const G = { left: G0.left, top: G0.top, width: G0.width / z, height: G0.height / z };
    const U = (r: DOMRect) => ({
      left: (r.left - G.left) / z + G.left,
      right: (r.right - G.left) / z + G.left,
      top: (r.top - G.top) / z + G.top,
      width: r.width / z,
      height: r.height / z,
    });
    const head = g.querySelector(':scope > .wf-node');
    if (!head) return;
    const lc = U(head.getBoundingClientRect());
    const x0 = lc.right - G.left,
      y0 = lc.top + lc.height / 2 - G.top,
      xr = G.width;
    const r = 8;
    const col = { t: '#22C55E', o: '#DC2626' };
    let d = '';
    g.querySelectorAll<HTMLElement>('.wf-lbranch').forEach((br) => {
      const b = br.classList.contains('t') ? 't' : 'o';
      const row = br.querySelector<HTMLElement>('.wf-brow')!;
      const R = U(row.getBoundingClientRect());
      const y1 = R.top + R.height / 2 - G.top;
      const fe = row.firstElementChild as HTMLElement | null;
      const le = row.lastElementChild as HTMLElement | null;
      if (!fe || !le) return;
      const first = U(fe.getBoundingClientRect()),
        last = U(le.getBoundingClientRect());
      const xs = x0 + 15,
        x1 = first.left - G.left + (fe.classList.contains('ghost') ? first.width : 0) - 1,
        xm = xr - 18,
        x2 = last.right - G.left - (le.classList.contains('ghost') ? last.width : 0);
      const sgn = y1 < y0 ? -1 : 1;
      const p1 = `M${x0} ${y0} H${xs - r} Q${xs} ${y0} ${xs} ${y0 + sgn * r} V${y1 - sgn * r} Q${xs} ${y1} ${xs + r} ${y1} H${x1}`;
      const a1 = `M${x1 - 6} ${y1 - 6} L${x1} ${y1} L${x1 - 6} ${y1 + 6}`;
      const p2 = `M${x2} ${y1} H${xm - r} Q${xm} ${y1} ${xm} ${y1 - sgn * r} V${y0 + sgn * r} Q${xm} ${y0} ${xm + r} ${y0} H${xr - 1}`;
      const a2 = `M${xr - 7} ${y0 - 6} L${xr - 1} ${y0} L${xr - 7} ${y0 + 6}`;
      d += `<path d="${p1} ${a1} ${p2} ${a2}" stroke="${col[b]}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    });
    svg.setAttribute('viewBox', `0 0 ${G.width} ${G.height}`);
    svg.setAttribute('width', String(G.width));
    svg.setAttribute('height', String(G.height));
    svg.innerHTML = d;
  }, [z]);
  useLayoutEffect(draw); // after every render (fields/branches changed)
  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    const ro = new ResizeObserver(draw);
    ro.observe(g);
    return () => ro.disconnect();
  }, [draw]); // drop targets widening, fonts loading
  return (
    <div className="wf-lgroup" ref={ref} data-gid={node.id}>
      <NodeCard node={node} />
      <div className="wf-lsplit" />
      <div className="wf-lbranches">
        <Branch node={node} b="t" />
        <Branch node={node} b="o" />
      </div>
      <div className="wf-lmerge" />
      <svg className="wf-lsvg" ref={svgRef} aria-hidden="true" />
    </div>
  );
}
