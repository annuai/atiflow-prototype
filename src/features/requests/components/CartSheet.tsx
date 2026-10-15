import { Trash01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { QuantityStepper } from '@/components/form/QuantityStepper';
import { BottomSheet } from '@/components/modal/BottomSheet';
import { copy } from '../copy';
import type { CartLine, RequestableItem } from '../model/types';

/** The cart: lives only while a person chooses (nothing is saved). Quantities can still be changed here; sending turns every line into its own request. */
export function CartSheet({
  isOpen,
  onOpenChange,
  lines,
  items,
  onQty,
  onRemove,
  onClear,
  onSend,
}: {
  isOpen: boolean;
  onOpenChange(o: boolean): void;
  lines: CartLine[];
  items: RequestableItem[];
  onQty(key: string, qty: number): void;
  onRemove(key: string): void;
  onClear(): void;
  onSend(): void;
}) {
  const rows = lines.flatMap((l) => {
    const item = items.find((i) => i.key === l.key);
    return item ? [{ line: l, item }] : [];
  });
  const waits = rows.filter((r) => r.item.needsApproval).length;
  return (
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={copy.request.cart.title}
      subtitle={copy.request.cart.subtitle}
      footer={
        <div className="flex flex-col gap-3">
          <p className="text-sm text-tertiary">
            {[
              waits ? copy.request.cart.waits(waits) : '',
              rows.length - waits ? copy.request.cart.direct(rows.length - waits) : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="flex gap-3">
            <Button size="xl" color="tertiary" onPress={onClear}>
              {copy.request.cart.clear}
            </Button>
            <Button size="xl" color="primary" className="flex-1" isDisabled={!rows.length} onPress={onSend}>
              {copy.request.cart.send(rows.length)}
            </Button>
          </div>
        </div>
      }
    >
      <ul className="flex flex-col gap-3 pt-2">
        {rows.map(({ line, item }) => (
          <li key={item.key} className="flex flex-wrap items-center gap-3 rounded-2xl border border-secondary p-3">
            <div className="min-w-0 flex-1 basis-40">
              <p className="font-semibold text-primary">{item.name}</p>
              <p className="font-mono text-sm text-tertiary">{item.code}</p>
              {item.needsApproval && (
                <Badge size="sm" color="warning" className="mt-1">
                  {copy.request.card.approval}
                </Badge>
              )}
            </div>
            {item.qtyEditable ? (
              <QuantityStepper value={line.qty} onChange={(v) => onQty(item.key, v)} />
            ) : (
              <p className="text-sm font-semibold text-primary">{copy.request.card.qty(line.qty)}</p>
            )}
            <ButtonUtility
              size="sm"
              className="!size-12"
              color="tertiary"
              icon={Trash01}
              tooltip="Remove"
              aria-label={`Remove ${item.name}`}
              onPress={() => onRemove(item.key)}
            />
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
