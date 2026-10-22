import type { ReactNode } from 'react';
import { Button } from '@/components/base/buttons/button';
import { CloseButton } from '@/components/base/buttons/close-button';
import { ModalFrame } from '@/components/modal/ModalShell';
import { copy } from '../copy';

/**
 * A short celebration after a setup step (Figma 70:13331 and 874:26774): a big title, one or two sentences, a card showing what was just made, "Skip for now" and the next thing to do.
 * One component for every milestone; what differs is only its text, the preview card and where the main button goes.
 */
export function MilestoneDialog({
  isOpen,
  title,
  body,
  preview,
  cta,
  onSkip,
  onCta,
}: {
  isOpen: boolean;
  title: string;
  body: string;
  preview: ReactNode;
  cta: string;
  onSkip(): void;
  onCta(): void;
}) {
  return (
    <ModalFrame isOpen={isOpen} onOpenChange={(o) => !o && onSkip()} size="md" label={title}>
      <div className="relative flex flex-col gap-5 p-6">
        <CloseButton className="absolute top-4 right-4" size="sm" />
        <div className="pr-8">
          <h2 className="text-display-xs font-semibold text-primary">{title}</h2>
          <p className="mt-2 text-md text-tertiary">{body}</p>
        </div>
        <div className="rounded-xl bg-secondary p-4 ring-1 ring-secondary">{preview}</div>
        <div className="flex gap-3">
          <Button color="secondary" size="lg" className="flex-1" onPress={onSkip}>
            {copy.milestone.skip}
          </Button>
          <Button color="primary" size="lg" className="flex-1" onPress={onCta}>
            {cta}
          </Button>
        </div>
      </div>
    </ModalFrame>
  );
}
