import { Trash01 } from '@untitledui/icons';
import { ModalShell } from '@/components/modal/ModalShell';
import { localized } from '@/i18n';

interface Props {
  isOpen: boolean;
  onOpenChange(o: boolean): void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm(): void;
}
/** Small destructive confirmation (the shared dialog shell with no body). */
export function ConfirmDialog({ isOpen, onOpenChange, title, description, confirmLabel, onConfirm }: Props) {
  return (
    <ModalShell
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      icon={Trash01}
      title={title}
      subtitle={description}
      secondary={{ label: localized('common').cancel, onPress: () => onOpenChange(false) }}
      primary={{
        label: confirmLabel,
        destructive: true,
        onPress: () => {
          onConfirm();
          onOpenChange(false);
        },
      }}
    >
      <span />
    </ModalShell>
  );
}
