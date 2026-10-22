import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName));

/**
 * Hold Space and drag to pan: while the key is down a sheet lies over the map and takes every press, so nothing under the pointer is selected, moved or drawn by mistake. Releasing Space (or
 * leaving the window) puts the map back as it was.
 */
export function useSpacePan(panBy: (dx: number, dy: number) => void) {
  const [held, setHeld] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || typing(e.target)) return;
      e.preventDefault(); // no page scroll
      setHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setHeld(false);
    };
    const off = () => setHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', off);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', off);
    };
  }, []);
  const sheet = held ? (
    <div
      data-testid="space-pan"
      className={`absolute inset-0 z-10 touch-none ${grabbing ? 'cursor-grabbing' : 'cursor-grab'}`}
      onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setGrabbing(true);
      }}
      onPointerMove={(e) => {
        if (e.buttons) panBy(e.movementX, e.movementY);
      }}
      onPointerUp={() => setGrabbing(false)}
      onPointerCancel={() => setGrabbing(false)}
    />
  ) : null;
  return sheet;
}
