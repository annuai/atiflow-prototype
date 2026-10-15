import { useState } from 'react';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { BottomSheet } from '@/components/modal/BottomSheet';
import { cx } from '@/utils/cx';
import { copy } from '../copy';
import { t } from '../text';
import type { TripRequest } from '../model/types';

function Form({ r, onClose, onReject }: { r: TripRequest; onClose(): void; onReject(reason: string): void }) {
  const [reason, setReason] = useState<string>(copy.approve.reject_.reasons[0]);
  const [note, setNote] = useState('');
  return (
    <BottomSheet
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title={copy.approve.reject_.title}
      subtitle={copy.approve.reject_.subtitle(`${r.qty > 0 ? `${r.name} ×${r.qty}` : r.name} · ${r.id}`)}
      footer={
        <div className="flex gap-3">
          <Button size="xl" color="tertiary" onPress={onClose}>
            {t.requests.cancel}
          </Button>
          <Button
            size="xl"
            color="primary-destructive"
            className="flex-1"
            onPress={() => onReject(note.trim() ? `${reason}: ${note.trim()}` : reason)}
          >
            {copy.approve.reject_.action}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-2">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.requests.tabsLabel.reason}>
          {copy.approve.reject_.reasons.map((x) => (
            <button
              key={x}
              type="button"
              role="radio"
              aria-checked={reason === x}
              onClick={() => setReason(x)}
              className={cx(
                'h-12 rounded-full border px-5 text-md font-medium',
                reason === x
                  ? 'border-brand bg-brand-secondary text-brand-secondary'
                  : 'border-primary bg-primary text-secondary',
              )}
            >
              {x}
            </button>
          ))}
        </div>
        <Input
          size="md"
          aria-label={copy.approve.reject_.note}
          placeholder={copy.approve.reject_.note}
          value={note}
          onChange={setNote}
        />
      </div>
    </BottomSheet>
  );
}
/** Mounted only while a request is being rejected, so every opening starts fresh. */
export const RejectSheet = ({
  request,
  onClose,
  onReject,
}: {
  request: TripRequest | null;
  onClose(): void;
  onReject(reason: string): void;
}) => (request ? <Form r={request} onClose={onClose} onReject={onReject} /> : null);
