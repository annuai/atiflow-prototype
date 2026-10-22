import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import type { Tour } from '../model/tours';
import { mountTourButtons } from '../ui/TourButtons';

export interface TourLabels {
  next: string;
  prev: string;
  done: string;
  progress(n: number, total: number): string;
}
export interface TourDeps {
  navigate(path: string): void;
  path(): string;
  labels: TourLabels;
  reducedMotion: boolean;
  /** what happened, for progress and analytics */
  onEvent(e: { type: 'started' | 'step' | 'done' | 'skipped'; stepId?: string; index?: number }): void;
}

/** Wait until something with this `data-tour` name is on the page (a page that was just opened draws a moment later). null = it did not come. */
export function waitForTarget(name: string, timeoutMs = 3000): Promise<Element | null> {
  const sel = `[data-tour="${name}"]`;
  return new Promise((resolve) => {
    const t0 = performance.now();
    const look = () => {
      const el = document.querySelector(sel);
      if (el) return resolve(el);
      if (performance.now() - t0 > timeoutMs) return resolve(null);
      window.setTimeout(look, 80);
    };
    look();
  });
}

/**
 * Runs a walkthrough one step at a time on top of Driver.js (the spotlight and the popover). Each step opens its page first, waits for its target, then points at it; Next / Back move,
 * Esc or the close button end it. A step whose target never shows up is skipped. Returns a function that ends the walkthrough.
 */
export function runTour(tour: Tour, deps: TourDeps): () => void {
  const total = tour.steps.length;
  let ended = false;
  let d: Driver | null = null;
  let unmountButtons: (() => void) | null = null;
  const end = (type: 'done' | 'skipped') => {
    if (ended) return;
    ended = true;
    unmountButtons?.();
    d?.destroy();
    deps.onEvent({ type });
  };
  d = driver({
    animate: !deps.reducedMotion,
    smoothScroll: !deps.reducedMotion,
    overlayOpacity: 0.55,
    stagePadding: 6,
    stageRadius: 10,
    popoverClass: 'ati-tour',
    allowClose: true,
    onDestroyStarted: () => end('skipped'),
  });
  async function show(i: number, dir: 1 | -1, guard = 0): Promise<void> {
    if (ended) return;
    if (i >= total) return end('done');
    if (i < 0) i = 0;
    if (guard > total) return end('done');
    const step = tour.steps[i];
    const here = deps.path().split('?')[0];
    if (step.route && !(step.onPage ? step.onPage(here) : here === step.route)) deps.navigate(step.route);
    const el = await waitForTarget(step.target);
    if (ended) return;
    if (!el) return show(i + dir, dir, guard + 1); // nothing to point at here: on to the next one
    const text = step.text();
    const last = i === total - 1;
    deps.onEvent({ type: 'step', stepId: step.id, index: i });
    d!.highlight({
      element: el,
      popover: {
        title: text.title,
        description: text.body,
        side: step.side ?? 'bottom',
        align: 'start',
        showButtons: ['close'], // Back / Next are our own Buttons, drawn in onPopoverRender
        progressText: deps.labels.progress(i + 1, total),
        showProgress: true,
        onPopoverRender: (popover) => {
          unmountButtons?.();
          unmountButtons = mountTourButtons(popover.footerButtons, {
            next: last ? deps.labels.done : deps.labels.next,
            prev: i === 0 ? undefined : deps.labels.prev,
            onNext: () => void show(i + 1, 1),
            onPrev: () => void show(i - 1, -1),
          });
        },
        onCloseClick: () => end('skipped'),
      },
    });
  }
  deps.onEvent({ type: 'started' });
  void show(0, 1);
  return () => end('skipped');
}
