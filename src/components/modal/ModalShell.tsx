import type { FC, FormEvent, ReactNode } from 'react';
import { Button } from '@/components/base/buttons/button';
import { CloseButton } from '@/components/base/buttons/close-button';
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon';
import { Dialog, Modal, ModalOverlay } from '@/components/application/modals/modal';
import { cx } from '@/utils/cx';

interface ModalAction {
  label: string;
  onPress?(): void;
  isDisabled?: boolean;
  isLoading?: boolean;
  destructive?: boolean;
}
type Size = 'md' | 'lg';
const WIDTH: Record<Size, string> = { md: 'max-w-[640px]', lg: 'max-w-[840px]' };

/** The overlay + dialog window only. Multi-step flows keep one frame open and swap the DialogLayout inside, so steps do not re-animate. */
export function ModalFrame({
  isOpen,
  onOpenChange,
  size = 'md',
  label,
  children,
}: {
  isOpen: boolean;
  onOpenChange(open: boolean): void;
  size?: Size;
  label: string;
  children: ReactNode;
}) {
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <Modal className={WIDTH[size]}>
        <Dialog aria-label={label}>{children}</Dialog>
      </Modal>
    </ModalOverlay>
  );
}

interface LayoutProps {
  icon: FC<{ className?: string }>;
  title: string;
  subtitle?: ReactNode;
  /** Hairlines between header, body and footer (device dialogs). */
  divided?: boolean;
  /** Footer buttons, equal width: [secondary (Cancel / Back), primary]. Omit `secondary` for a single button. */
  secondary?: ModalAction;
  primary: ModalAction;
  /** When set, the content is a <form> and the primary button submits it. */
  onSubmit?(): void;
  children: ReactNode;
}
/** Dialog content: featured icon + title + supporting text + close, body slot, two equal footer buttons. */
export function DialogLayout({ icon, title, subtitle, divided, secondary, primary, onSubmit, children }: LayoutProps) {
  const Wrap = onSubmit ? 'form' : 'div';
  const wrapProps = onSubmit
    ? {
        onSubmit: (e: FormEvent) => {
          e.preventDefault();
          onSubmit();
        },
        noValidate: true,
      }
    : {};
  return (
    <Wrap {...wrapProps}>
      <div className={cx('relative px-6 pt-6 pb-5', divided && 'border-b border-secondary')}>
        <FeaturedIcon icon={icon} color="gray" theme="modern" size="lg" className="mb-4" />
        <h2 className="text-md font-semibold text-primary">{title}</h2>
        {subtitle && <p className="pr-8 text-sm text-tertiary">{subtitle}</p>}
        <CloseButton className="absolute top-4 right-4" size="sm" />
      </div>
      <div className="px-6 pb-2">{children}</div>
      <div className={cx('flex gap-3 px-6 py-6', divided && 'mt-4 border-t border-secondary')}>
        {secondary && (
          <Button
            type="button"
            color="secondary"
            size="lg"
            className="flex-1"
            isDisabled={secondary.isDisabled}
            onPress={secondary.onPress}
          >
            {secondary.label}
          </Button>
        )}
        <Button
          type={onSubmit ? 'submit' : 'button'}
          color={primary.destructive ? 'primary-destructive' : 'primary'}
          size="lg"
          className="flex-1"
          isDisabled={primary.isDisabled}
          isLoading={primary.isLoading}
          onPress={onSubmit ? undefined : primary.onPress}
        >
          {primary.label}
        </Button>
      </div>
    </Wrap>
  );
}

/** A single-window dialog: frame + layout. Every one-step dialog in the configurator is this plus a body. */
export function ModalShell({
  isOpen,
  onOpenChange,
  size,
  ...layout
}: LayoutProps & { isOpen: boolean; onOpenChange(open: boolean): void; size?: Size }) {
  return (
    <ModalFrame isOpen={isOpen} onOpenChange={onOpenChange} size={size} label={layout.title}>
      <DialogLayout {...layout} />
    </ModalFrame>
  );
}
