import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { ZoomBar } from '@/ui/ZoomBar';
import { useBuilderDnd } from '../hooks/useBuilderDnd';
import { useCamera, Z_MAX, Z_MIN } from '../hooks/useCamera';
import { selectNodes, useWorkflow, wfStore } from '../model/store';
import { AiPromptBar } from './AiPromptBar';
import { FlowCtx } from './FlowContext';
import { FlowTree } from './FlowTree';
import { MapMini, MapPreview } from './MapPreview';
import { NodePalette } from './NodePalette';

/** The pannable/zoomable workflow surface with its floating palette, AI bar, zoom control and (when not docked) the map preview. */
export function WorkflowCanvas({
  mapOpen,
  setMapOpen,
  docked,
}: {
  mapOpen: boolean;
  setMapOpen: (v: boolean) => void;
  docked: boolean;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const cam = useCamera(canvas, inner);
  const dnd = useBuilderDnd({ canvasRef: canvas, flowRef: inner, getZoom: cam.getZoom, panBy: cam.panBy });
  const nodes = useWorkflow(selectNodes);
  const current = useWorkflow((s) => s.current);
  const justAdded = useWorkflow((s) => s.justAdded);
  const simCur = useWorkflow((s) => s.sim.currentId);

  const { apply } = cam;
  const lastFleet = useRef(current);
  // a different fleet -> fit again (before paint); same fleet -> keep the view. `cam` is rebuilt every render, its functions are what we call.
  useLayoutEffect(() => {
    if (lastFleet.current !== current) {
      lastFleet.current = current;
      cam.resetFit();
    }
    cam.ensureFit();
  }, [nodes, current]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (justAdded)
      requestAnimationFrame(() => cam.reveal(inner.current?.querySelector(`[data-node-id="${justAdded}"]`) ?? null));
  }, [justAdded, nodes]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (simCur) cam.reveal(inner.current?.querySelector(`[data-node-id="${simCur}"]`) ?? null, 0);
  }, [simCur]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const on = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      wfStore.getState().select(id);
      requestAnimationFrame(() => cam.reveal(inner.current?.querySelector(`[data-node-id="${id}"]`) ?? null));
    };
    window.addEventListener('wf:reveal', on);
    return () => window.removeEventListener('wf:reveal', on);
  }, [cam.reveal]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ro = new ResizeObserver(() => apply());
    ro.observe(c);
    return () => ro.disconnect();
  }, [apply]);
  // keyboard: Delete removes the selected node; Ctrl/Cmd+Z undo, +Shift redo
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input, textarea, [role=combobox], [role=listbox]');
      const s = wfStore.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selected && !typing) {
        e.preventDefault();
        s.removeNode(s.selected);
      }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);
  const ctx = useMemo(() => ({ zoom: cam.zoom, startCardDrag: dnd.startCardDrag }), [cam.zoom, dnd.startCardDrag]);

  return (
    <div
      className="canvas wf-canvas"
      ref={canvas}
      onClick={(e) => {
        if (
          !(e.target as HTMLElement).closest('.wf-node, [data-no-pan]') &&
          !canvas.current?.classList.contains('panning')
        )
          wfStore.getState().select(null);
      }}
    >
      <FlowCtx.Provider value={ctx}>
        <FlowTree innerRef={inner} />
      </FlowCtx.Provider>
      <NodePalette onTileDown={dnd.startPaletteDrag} />
      <AiPromptBar />
      <ZoomBar
        pct={Math.round(cam.zoom * 100)}
        onIn={cam.zoomIn}
        onOut={cam.zoomOut}
        onReset={() => cam.setZoom(1)}
        canIn={cam.zoom < Z_MAX - 1e-6}
        canOut={cam.zoom > Z_MIN + 1e-6}
      />
      {!docked &&
        (mapOpen ? (
          <MapPreview mode="float" canvasRef={canvas} onClose={() => setMapOpen(false)} />
        ) : (
          <MapMini onOpen={() => setMapOpen(true)} />
        ))}
    </div>
  );
}
