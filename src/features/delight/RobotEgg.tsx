import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RobotBeacon } from '@/components/data/RobotBeacon';
import robot from '@/assets/robots/sherpa-xt-lite.svg';
import ribbonTip from './assets/ribbon-tip.svg';
import { copy } from './copy';
import { dropEgg, EGG_SPEED, modalOpen, reportDriven, useEgg, type EggItem, type Lane } from './eggs';
import { beep } from './sound';
import './delight.css';

type Of<K extends EggItem['kind']> = Extract<EggItem, { kind: K }>;

const laneStyle = (l: Lane) => ({ left: l.left, top: l.top, width: l.width });
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Removes the item when its animation ends (or after a short while when motion is off, so nothing stays). */
function useGone(id: number) {
  useEffect(() => {
    if (!reduced()) return;
    const t = window.setTimeout(() => dropEgg(id), 3500);
    return () => window.clearTimeout(t);
  }, [id]);
  return () => dropEgg(id);
}

function Ribbon({ text }: { text: string }) {
  return (
    <div className="egg-tail">
      <img src={ribbonTip} alt="" className="egg-tip" />
      <div className="egg-ribbon">{text}</div>
    </div>
  );
}

function Driver({ r }: { r: Of<'robot'> }) {
  const gone = useGone(r.id);
  const [poked, setPoked] = useState(0);
  const [paused, setPaused] = useState(false);
  // the group drives from just outside the left edge to the right edge, so its way is the lane plus its OWN width: a robot with a ribbon is wider and would be faster at one fixed time
  const drive = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(90);
  useLayoutEffect(() => {
    const w = drive.current?.offsetWidth ?? 90;
    setWidth(w);
    reportDriven(r.unit, r.id, r.delay, w);
  }, [r.unit, r.id, r.delay]);
  const seconds = (r.lane.width + width) / EGG_SPEED + (r.stop ? 2.6 : 0);
  const line = poked ? copy.clicks[(poked - 1) % copy.clicks.length] : r.text;
  const poke = () => {
    beep([520, 520]);
    setPoked((n) => n + 1);
    setPaused(true);
    window.setTimeout(() => setPaused(false), 1800);
  };
  return (
    <div className="egg-lane" aria-hidden style={laneStyle(r.lane)}>
      <div
        ref={drive}
        className={`egg-drive ${r.stop ? 'egg-stops' : ''} ${paused ? 'egg-paused' : ''}`}
        style={
          { '--lane': `${r.lane.width}px`, '--time': `${seconds}s`, '--delay': `${r.delay}s` } as React.CSSProperties
        }
        onAnimationEnd={gone}
      >
        {line ? <Ribbon text={line} /> : null}
        <button type="button" tabIndex={-1} className={`egg-bot ${paused ? 'egg-honk' : ''}`} onClick={poke}>
          <img src={robot} alt="" style={r.hue ? { filter: `hue-rotate(${r.hue}deg)` } : undefined} />
          <RobotBeacon />
        </button>
      </div>
      {r.stop ? (
        <div className="egg-battery" style={{ '--time': `${seconds}s` } as React.CSSProperties}>
          <i />
        </div>
      ) : null}
    </div>
  );
}

function Dancer({ r }: { r: Of<'dance'> }) {
  const gone = useGone(r.id);
  return (
    <div
      className="egg-dancer"
      aria-hidden
      style={{ left: r.lane.left + r.lane.width / 2, top: r.lane.top }}
      onAnimationEnd={gone}
    >
      <Ribbon text={r.text} />
      <div className="egg-bot">
        <img src={robot} alt="" />
        <RobotBeacon />
      </div>
    </div>
  );
}

function Confetti({ r }: { r: Of<'confetti'> }) {
  useEffect(() => {
    const t = window.setTimeout(() => dropEgg(r.id), 5500);
    return () => window.clearTimeout(t);
  }, [r.id]);
  return (
    <div className="egg-confetti" aria-hidden>
      {r.pieces.map((p, i) => (
        <span
          key={i}
          style={
            {
              left: `${p.x}%`,
              width: p.size,
              height: p.size * 0.5,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.time}s`,
              '--dx': `${p.dx}px`,
              '--spin': `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** Draws every easter egg that is on its way: robots with ribbons, a dancer and confetti. */
export function EggLayer() {
  const items = useEgg((s) => s.items);
  // a dialog that opens while a robot is driving: it waits (paused and hidden) until the dialog closes
  useEffect(() => {
    const root = document.documentElement;
    const check = () => root.toggleAttribute('data-egg-modal', modalOpen());
    const watch = new MutationObserver(check);
    watch.observe(document.body, { childList: true, subtree: true });
    check();
    return () => {
      watch.disconnect();
      root.removeAttribute('data-egg-modal');
    };
  }, []);
  return (
    <>
      {items.map((it) =>
        it.kind === 'robot' ? (
          <Driver key={it.id} r={it} />
        ) : it.kind === 'dance' ? (
          <Dancer key={it.id} r={it} />
        ) : (
          <Confetti key={it.id} r={it} />
        ),
      )}
    </>
  );
}
