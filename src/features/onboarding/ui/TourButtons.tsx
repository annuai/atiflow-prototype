import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Button } from '@/components/base/buttons/button';

interface Props {
  next: string;
  prev?: string;
  onNext(): void;
  onPrev(): void;
}

/** Draws the walkthrough's Back / Next buttons with our own Button into Driver.js's footer, so they match every other button in the app. Returns a function that removes them. */
export function mountTourButtons(container: HTMLElement, p: Props): () => void {
  const root = createRoot(container);
  flushSync(() =>
    root.render(
      <div className="ati-tour-buttons flex gap-1">
        {p.prev && (
          <Button size="sm" color="secondary" onPress={p.onPrev}>
            {p.prev}
          </Button>
        )}
        <Button size="sm" color="primary" onPress={p.onNext}>
          {p.next}
        </Button>
      </div>,
    ),
  ); // drawn at once: Driver.js measures the popover to place it, so the buttons must already be in it
  return () => window.setTimeout(() => root.unmount()); // (not while React is still rendering)
}
