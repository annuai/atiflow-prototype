import { useState } from 'react';
import { Check } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { QuantityStepper } from '@/components/form/QuantityStepper';
import { cx } from '@/utils/cx';
import { copy } from '../copy';
import type { CartLine, RequestableItem } from '../model/types';

/** One material a person can request: name, code and group big enough to read at arm's length, the quantity (a stepper when the workflow lets the tablet choose it), and one big button. */
export function MaterialCard({
  item,
  line,
  onAdd,
  onRemove,
}: {
  item: RequestableItem;
  line?: CartLine;
  onAdd(qty: number): void;
  onRemove(): void;
}) {
  const [qty, setQty] = useState(line?.qty ?? item.qty);
  const changed = !!line && line.qty !== qty;
  return (
    <article
      className={cx(
        'flex flex-col gap-3 rounded-2xl border bg-primary p-4 shadow-xs',
        line ? 'border-brand ring-2 ring-brand/30' : 'border-secondary',
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-snug text-primary">{item.name}</h3>
          <p className="font-mono text-sm text-tertiary">{item.code}</p>
        </div>
        {line && (
          <Badge size="md" type="pill-color" color="brand">
            <Check className="size-3.5" />
            {copy.request.card.inCart(line.qty)}
          </Badge>
        )}
      </header>
      <div className="flex flex-wrap items-center gap-2">
        {item.group && (
          <Badge size="md" color="gray">
            {item.group}
          </Badge>
        )}
        {item.needsApproval && (
          <Badge size="md" color="warning">
            {copy.request.card.approval}
          </Badge>
        )}
      </div>
      <p className="text-xs text-tertiary">
        {item.workflowName} · {item.fleet}
      </p>
      <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
        {item.qtyEditable ? (
          <QuantityStepper value={qty} onChange={setQty} />
        ) : (
          <p className="text-sm text-secondary">
            <span className="font-semibold text-primary">{copy.request.card.qty(item.qty)}</span> ·{' '}
            {copy.request.card.fixed}
          </p>
        )}
        <div className="flex gap-2">
          {line && (
            <Button size="lg" color="tertiary" onPress={onRemove}>
              {copy.request.card.remove}
            </Button>
          )}
          <Button
            size="lg"
            color={line && !changed ? 'secondary' : 'primary'}
            isDisabled={!!line && !changed}
            onPress={() => onAdd(item.qtyEditable ? qty : item.qty)}
          >
            {line ? copy.request.card.update : copy.request.card.add}
          </Button>
        </div>
      </footer>
    </article>
  );
}
