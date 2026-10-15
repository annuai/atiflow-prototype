import { useEffect, useRef, type RefObject } from 'react';
import { MOTION } from './tokens';

/**
 * Drives the moving line of a tab list WITHOUT React state or layout projection (both made it jitter): it measures the chosen tab and writes four CSS variables on the tab list
 * (`--tab-pos`, `--tab-size`, `--tab-ms`, `--tab-ease`); the list draws the line from them and the browser animates the change (a plain CSS transition on transform and size).
 * The first measurement and any re-measurement caused by a resize or a font loading are applied at once; only a change of the chosen tab animates (`data-tab-animate`).
 * `axis` is where the line runs: `x` for a row of tabs (a line under them), `y` for a column (a line beside them).
 */
export function useTabIndicator(axis: 'x' | 'y'): RefObject<HTMLDivElement | null> {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const { duration, ease } = MOTION.tab.indicator;
    el.style.setProperty('--tab-ms', `${duration * 1000}ms`);
    el.style.setProperty('--tab-ease', ease);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; // then the line simply jumps
    const enable = () => !reduced && el.setAttribute('data-tab-animate', '');
    let chosen: Element | null = null;
    const place = () => {
      const tab = el.querySelector('[role="tab"][aria-selected="true"]') as HTMLElement | null;
      if (!tab) return;
      chosen = tab;
      el.style.setProperty('--tab-pos', `${axis === 'x' ? tab.offsetLeft : tab.offsetTop}px`);
      el.style.setProperty('--tab-size', `${axis === 'x' ? tab.offsetWidth : tab.offsetHeight}px`);
    };
    place();
    const frame = requestAnimationFrame(enable); // from the next frame on, a change of tab glides
    const choice = new MutationObserver(place); // the chosen tab changed, or the tabs only now appeared (the list builds its items after the first render)
    choice.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-selected'] });
    const size = new ResizeObserver(() => {
      el.removeAttribute('data-tab-animate'); // the tabs moved by themselves (window resize, badge appeared): follow them at once
      place();
      requestAnimationFrame(enable);
    });
    size.observe(el);
    if (chosen) size.observe(chosen);
    return () => {
      cancelAnimationFrame(frame);
      choice.disconnect();
      size.disconnect();
    };
  }, [axis]);
  return list;
}
