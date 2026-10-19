import { create } from 'zustand';
import { handle } from '@/ui/engineHandle';
import { store as floorStore } from '@/core/store';
import { copy } from './copy';
import { beep } from './sound';

/** Where a robot drives: the top edge of a box (px of the window). */
export interface Lane {
  left: number;
  top: number;
  width: number;
}
export type EggItem =
  | { kind: 'robot'; id: number; lane: Lane; text?: string; hue: number; delay: number; stop: boolean }
  | { kind: 'dance'; id: number; lane: Lane; text: string }
  | { kind: 'confetti'; id: number; pieces: Piece[] };
export interface Piece {
  x: number;
  size: number;
  color: string;
  dx: number;
  spin: number;
  delay: number;
  time: number;
}
type Distributive<T> = T extends unknown ? Omit<T, 'id'> : never;

let count = 0;
export const useEgg = create<{ items: EggItem[] }>(() => ({ items: [] }));
const add = (item: Distributive<EggItem>) =>
  useEgg.setState((s) => ({ items: [...s.items, { ...item, id: count++ } as EggItem] }));
export const dropEgg = (id: number) => useEgg.setState((s) => ({ items: s.items.filter((x) => x.id !== id) }));

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** The top edge of the page card: robots ride along it. Pages without a card use the main area. */
export function cardLane(): Lane {
  const r = (document.querySelector('[data-page-card]') ?? document.querySelector('.main'))?.getBoundingClientRect();
  return { left: r?.left ?? 0, top: r?.top ?? 80, width: r?.width ?? window.innerWidth };
}
const screenLane = (): Lane => ({ left: 0, top: window.innerHeight * 0.55, width: window.innerWidth });

let niceNext = 0;
/** The next kind message: one after the other, then round again. */
export const nextMessage = () => copy.robot[niceNext++ % copy.robot.length];

export interface RobotOptions {
  text?: string;
  hue?: number;
  delay?: number;
  stop?: boolean;
  lane?: Lane;
}
export const sendRobot = (o: RobotOptions = {}) =>
  add({
    kind: 'robot',
    lane: o.lane ?? cardLane(),
    text: o.text,
    hue: o.hue ?? 0,
    delay: o.delay ?? 0,
    stop: o.stop ?? false,
  });

const COLORS = ['#33bab1', '#fcd900', '#f97316', '#6366f1', '#ec4899', '#22c55e'];
export function confetti() {
  if (reduced()) return;
  const pieces: Piece[] = Array.from({ length: 90 }, () => ({
    x: Math.random() * 100,
    size: 6 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    dx: (Math.random() - 0.5) * 160,
    spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 720),
    delay: Math.random() * 0.8,
    time: 2.4 + Math.random() * 1.6,
  }));
  add({ kind: 'confetti', pieces });
}

const convoy = (hues: number[], text: string, gap = 0.8, lane?: Lane) =>
  hues.forEach((hue, i) => sendRobot({ hue, delay: i * gap, text: i === hues.length - 1 ? text : undefined, lane }));

/** The robot that drives through the 3D Live Floor, when it is on screen in 3D. */
const in3d = () => !!handle.engine && floorStore.getState().cameraMode !== 'top';

const WORDS: Record<string, () => void> = {
  robottt: () => {
    const text = nextMessage();
    if (in3d()) handle.engine!.egg(text);
    else sendRobot({ text });
  },
  party: () => {
    confetti();
    sendRobot({ text: copy.party });
  },
  fleet: () => convoy([0, 70, 160, 270], copy.fleet),
  charge: () => sendRobot({ text: `⚡ ${copy.charge}`, stop: true }),
  dance: () => add({ kind: 'dance', lane: cardLane(), text: copy.dance }),
  coffee: () => sendRobot({ text: `☕ ${copy.coffee}` }),
  hello: () => sendRobot({ text: copy.hello }),
  beep: () => {
    beep([660, 880, 660]);
    sendRobot({ text: copy.beep });
  },
};
WORDS.confetti = WORDS.party;
WORDS.zap = WORDS.charge;
WORDS.namaste = WORDS.hello;

/** Search box: a secret word + Enter. True when the word was an easter egg (so it is not searched for). */
export function runEgg(text: string): boolean {
  const run = WORDS[text.trim().toLowerCase()];
  if (!run) return false;
  run();
  return true;
}

/** The big one: a parade of robots across the whole window, with confetti. */
export function parade() {
  confetti();
  convoy([0, 50, 100, 150, 200, 250, 300], copy.konami, 0.7, screenLane());
}

/** A line, shown by a small celebration, for something the person did (first workflow, first map, an empty queue). */
export const celebrate = (text: string) => sendRobot({ text });
