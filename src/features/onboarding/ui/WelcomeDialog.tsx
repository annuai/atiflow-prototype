import { Button } from '@/components/base/buttons/button';
import { Badge } from '@/components/base/badges/badges';
import { CloseButton } from '@/components/base/buttons/close-button';
import { ModalFrame } from '@/components/modal/ModalShell';
import mark from '@/ui/icons/ati-logo-black.svg';
import { copy } from '../copy';

const ITEMS = ['i1', 'i2', 'i3', 'i4'] as const;

/**
 * The first window a new person sees (Figma 70:13091), built on our modal frame: logo, title and version in the header, "What's New" as four short items, the legal line and two equal
 * buttons. Start Walkthrough begins the tour; Skip Walkthrough closes it (the same walkthrough stays available from the user menu).
 */
export function WelcomeDialog({ isOpen, onStart, onSkip }: { isOpen: boolean; onStart(): void; onSkip(): void }) {
  const t = copy.welcome;
  return (
    <ModalFrame isOpen={isOpen} onOpenChange={(o) => !o && onSkip()} size="md" label={t.title}>
      <div className="relative flex max-h-[min(720px,calc(100dvh-48px))] flex-col">
        <header className="flex items-center gap-3 border-b border-secondary px-6 py-4 pr-14">
          <img src={mark} alt="" className="size-8" />
          <h2 className="text-md font-semibold text-primary">{t.title}</h2>
          <Badge size="sm" color="brand">
            v4.0
          </Badge>
          <CloseButton className="absolute top-3.5 right-4" size="sm" />
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <h3 className="text-display-xs font-semibold text-primary">{t.whatsNew}</h3>
          <ul className="mt-4 flex flex-col gap-4">
            {ITEMS.map((k) => (
              <li key={k}>
                <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <span className="size-1.5 shrink-0 rounded-full bg-fg-brand-primary" aria-hidden />
                  {t[k].title}
                </p>
                <p className="mt-1 text-sm text-tertiary">{t[k].body}</p>
              </li>
            ))}
          </ul>
        </div>
        <footer className="flex flex-col gap-4 border-t border-secondary px-6 py-5">
          <p className="text-xs text-tertiary">{t.legal}</p>
          <div className="flex gap-3">
            <Button color="secondary" size="lg" className="flex-1" onPress={onSkip}>
              {t.skip}
            </Button>
            <Button color="primary" size="lg" className="flex-1" onPress={onStart}>
              {t.start}
            </Button>
          </div>
        </footer>
      </div>
    </ModalFrame>
  );
}
