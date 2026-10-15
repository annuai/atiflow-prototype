import { useRef } from 'react';
import { XClose } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { store, useApp } from '../core/store';
import { handle } from './engineHandle';
import { useCoarse } from './useCoarse';
import { copy } from './copy';

const R = 52; // stick travel in px

/** Touch controls for walk mode: left virtual stick = move (push past 90% to run), drag the view = look, button = exit. */
export function WalkPad() {
  const mode = useApp((s) => s.cameraMode);
  const coarse = useCoarse();
  const knob = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  if (mode !== 'walk' || !coarse) return null;
  const move = (e: React.PointerEvent) => {
    const o = origin.current;
    if (!o) return;
    let dx = e.clientX - o.x,
      dy = e.clientY - o.y;
    const m = Math.hypot(dx, dy);
    if (m > R) {
      dx = (dx / m) * R;
      dy = (dy / m) * R;
    }
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
    handle.engine?.setWalkInput(-dy / R, dx / R);
  };
  const end = () => {
    origin.current = null;
    if (knob.current) knob.current.style.transform = '';
    handle.engine?.setWalkInput(0, 0);
  };
  return (
    <>
      <div
        className="walkpad"
        role="application"
        aria-label={copy.walk.stick}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const r = e.currentTarget.getBoundingClientRect();
          origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          move(e);
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="knob" ref={knob} />
      </div>
      <div className="walkexit">
        <Button
          size="sm"
          color="secondary"
          iconLeading={XClose}
          onPress={() => store.getState().setCameraMode('orbit')}
        >
          {copy.walk.exit}
        </Button>
      </div>
    </>
  );
}
