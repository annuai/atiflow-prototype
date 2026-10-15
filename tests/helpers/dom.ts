import { vi } from 'vitest';

/** What jsdom lacks and the app's components need: media queries, resize observation, scrolling. Call once at the top of a component test. */
export function installDomShims() {
  if (!window.matchMedia)
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  if (!('ResizeObserver' in window))
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  Element.prototype.scrollTo ??= vi.fn() as never;
  Element.prototype.scrollIntoView ??= vi.fn() as never;
}
