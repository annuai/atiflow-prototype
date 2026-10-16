import { localized } from '@/i18n';
import { copy } from '../copy';
import { CallSheet } from './CallSheet';

const common = localized('common');

/** "Call a robot": the confirmation of one custom trip (robot type, from -> to) before it is booked. Open when `trip` is set and `isOpen`. */
export function CustomCallSheet({
  isOpen,
  trip,
  onOpenChange,
  onSend,
}: {
  isOpen: boolean;
  trip: { robot: string; from: string; to: string } | null;
  onOpenChange(o: boolean): void;
  onSend(): void;
}) {
  return (
    <CallSheet
      isOpen={isOpen && !!trip}
      onOpenChange={onOpenChange}
      title={copy.call.single.title}
      subtitle={copy.call.single.subtitle}
      rows={trip ? [{ key: 'custom', title: trip.robot, detail: `${trip.from} → ${trip.to}` }] : []}
      clearLabel={common.cancel}
      sendLabel={copy.call.single.send}
      onClear={() => onOpenChange(false)}
      onSend={onSend}
    />
  );
}
