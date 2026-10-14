import type { ReactNode } from 'react';
import { CloseButton } from '@/components/base/buttons/close-button';
import { Dialog, Modal, ModalOverlay } from '@/components/application/modals/modal';

/**
 * A sheet that slides up from the bottom (tablet / phone convention: reachable with a thumb, big controls, content scrolls inside).
 * Full width on small screens, a centred column on larger ones. `footer` stays pinned under the scrolling content.
 */
export function BottomSheet({ isOpen, onOpenChange, title, subtitle, footer, children }: { isOpen: boolean; onOpenChange(o: boolean): void; title: string; subtitle?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable className="items-end !px-0 sm:!px-6 !pb-0 !pt-10 sm:items-end">
      <Modal className="mx-auto flex max-w-2xl flex-col !rounded-b-none !rounded-t-3xl sm:!rounded-b-none data-[entering]:!animate-in data-[entering]:!slide-in-from-bottom">
        <Dialog aria-label={title} className="flex max-h-[85dvh] flex-col">
          <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-quaternary/40" aria-hidden />
          <header className="relative shrink-0 px-6 pt-3 pb-3"><h2 className="pr-10 text-lg font-semibold text-primary">{title}</h2>{subtitle && <p className="text-sm text-tertiary">{subtitle}</p>}<CloseButton className="absolute top-2 right-4" size="md" /></header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">{children}</div>
          {footer && <footer className="shrink-0 border-t border-secondary bg-primary px-6 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">{footer}</footer>}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
