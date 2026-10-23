import { create } from 'zustand';
import { authStore } from '@/features/auth';
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
  | { kind: 'robot'; id: number; unit: number; lane: Lane; text?: string; hue: number; delay: number; stop: boolean }
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
  // never above the top bar: a page that is still loading (or leaving) has no card yet, or one that is not in its place
  const floor = (document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 64) + 60;
  const cards = [...document.querySelectorAll('[data-page-card]')].map((c) => c.getBoundingClientRect());
  const r =
    cards.find((c) => c.height > 100 && c.top >= floor - 10) ??
    document.querySelector('.main')?.getBoundingClientRect();
  return { left: r?.left ?? 0, top: Math.max(r?.top ?? 0, floor), width: r?.width ?? window.innerWidth };
}
const screenLane = (): Lane => ({ left: 0, top: window.innerHeight * 0.55, width: window.innerWidth });

/** Good morning / afternoon / evening and the person's first name, by the hour on this device. */
export function greeting(hour = new Date().getHours()): string | null {
  const name = authStore.getState().user?.firstName;
  if (!name) return null;
  return hour < 12 ? copy.morning(name) : hour < 17 ? copy.afternoon(name) : copy.evening(name);
}
let bag: number[] = [];
let lastPick = -1;
/** Starts the shuffle again (tests). */
export const resetMessages = () => {
  bag = [];
  lastPick = -1;
};
/** A shuffled bag of every message: each is used once, in no fixed order, and only when the bag is empty is it shuffled again (never starting with the one just shown). */
function refill(size: number) {
  bag = Array.from({ length: size }, (_, i) => i);
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  if (size > 1 && bag[0] === lastPick) [bag[0], bag[size - 1]] = [bag[size - 1], bag[0]];
}
/** The next kind message: the greeting is one of them, and none repeats until all have been shown. */
export function nextMessage(): string {
  const size = copy.robot.length + 1;
  if (!bag.length) refill(size);
  lastPick = bag.shift()!;
  return lastPick < copy.robot.length ? copy.robot[lastPick] : (greeting() ?? copy.robot[0]);
}

export interface RobotOptions {
  text?: string;
  hue?: number;
  delay?: number;
  stop?: boolean;
  lane?: Lane;
}
// Robots appear one after the other, each right behind the one before: the next starts as soon as the one on the stage has fully driven in (its ribbon included), so it never covers a
// ribbon. A convoy or a parade is one unit (it counts as in once its last robot is). Things that stay in one place (a dancer, a robot that stops to charge) keep the stage until they leave.
const queue: (() => number | void)[] = [];
/** Pixels between the end of one ribbon and the next robot, and how fast robots drive (must match RobotEgg). */
export const EGG_GAP = 40;
export const EGG_SPEED = 110;
let busy = false;
let unitSeq = 0;
let unit: { id: number; robots: number; startedAt: number; wait: number; keep: boolean; seen: Set<number> } | null =
  null;
let timed = false;
let launching = false;
const clear = () => !useEgg.getState().items.some((i) => i.kind !== 'confetti');
const release = (unitId?: number) => {
  if (unitId !== undefined && unit?.id !== unitId) return; // a timer of a unit that has already been released
  busy = false;
  timed = false;
  unit = null;
  pump();
};
/** A dialog (or the walkthrough) is open: the robots stay in the garage until it closes. */
export const modalOpen = () =>
  typeof document !== 'undefined' &&
  !!document.querySelector('[role="dialog"][data-rac], [role="alertdialog"], .driver-popover');
let waiting = 0;
function pump() {
  if (queue.length && !busy && modalOpen()) {
    if (!waiting)
      waiting = window.setInterval(() => {
        if (modalOpen()) return;
        window.clearInterval(waiting);
        waiting = 0;
        pump();
      }, 400);
    return;
  }
  while (!busy && queue.length) {
    busy = true;
    unit = { id: ++unitSeq, robots: 0, startedAt: Date.now(), wait: 0, keep: false, seen: new Set() };
    launching = true;
    const hold = queue.shift()!();
    launching = false;
    if (typeof hold === 'number') {
      timed = true;
      window.setTimeout(release, hold, unit.id);
    } else if ((unit.robots === 0 || unit.keep) && clear()) busy = false;
  }
}
useEgg.subscribe(() => {
  // nothing is left on the stage and nothing is counting down (it was taken away, or it stays in place and has now gone): the next unit may start
  if (busy && !timed && !launching && clear()) release();
});
/** A robot of the unit on the stage measured itself: once the last one is fully in, the next unit may start. */
export function reportDriven(unitId: number, robotId: number, delaySeconds: number, widthPx: number) {
  if (!unit || unit.id !== unitId || unit.keep || unit.seen.has(robotId)) return; // (React may run an effect twice in development)
  unit.seen.add(robotId);
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  unit.wait = Math.max(unit.wait, reduced ? 3500 : (delaySeconds + (widthPx + EGG_GAP) / EGG_SPEED) * 1000);
  unit.robots -= 1;
  if (unit.robots > 0) return;
  timed = true;
  window.setTimeout(release, Math.max(0, unit.wait - (Date.now() - unit.startedAt)), unit.id);
}
export const sendRobot = (o: RobotOptions = {}) => {
  if (unit) {
    unit.robots += 1;
    if (o.stop) unit.keep = true;
  }
  add({
    kind: 'robot',
    unit: unit?.id ?? 0,
    lane: o.lane ?? cardLane(),
    text: o.text,
    hue: o.hue ?? 0,
    delay: o.delay ?? 0,
    stop: o.stop ?? false,
  });
};

/** Runs `launch` now, or when the unit before it is fully in. It may return how long (ms) it keeps the stage when it draws outside the store. */
const later = (launch: () => number | void) => {
  queue.push(launch);
  pump();
};

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
    later(() => {
      if (in3d()) {
        handle.engine!.egg(text);
        return 9500;
      }
      sendRobot({ text });
    });
  },
  party: () =>
    later(() => {
      confetti();
      sendRobot({ text: copy.party });
    }),
  fleet: () => later(() => convoy([0, 70, 160, 270], copy.fleet)),
  charge: () => later(() => sendRobot({ text: `⚡ ${copy.charge}`, stop: true })),
  dance: () => later(() => add({ kind: 'dance', lane: cardLane(), text: copy.dance })),
  coffee: () => later(() => sendRobot({ text: `☕ ${copy.coffee}` })),
  hello: () => later(() => sendRobot({ text: copy.hello })),
  beep: () =>
    later(() => {
      beep([660, 880, 660]);
      sendRobot({ text: copy.beep });
    }),
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
export const parade = () =>
  later(() => {
    confetti();
    convoy([0, 50, 100, 150, 200, 250, 300], copy.konami, 0.7, screenLane());
  });

/** A line, shown by a small celebration, for something the person did (first workflow, first map, an empty queue). */
export const celebrate = (text: string) => later(() => sendRobot({ text }));
