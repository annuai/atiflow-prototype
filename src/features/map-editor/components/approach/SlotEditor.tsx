import { useState } from 'react';
import { ChevronDown, ChevronUp } from '@untitledui/icons';
import { Label } from '@/components/base/input/label';
import { RadioButton, RadioGroup } from '@/components/base/radio-buttons/radio-buttons';
import { Select } from '@/components/base/select/select';
import { MANEUVERS, maneuverOf, type ParamKey } from '../../model/approach';
import { approachOf, paramValue, shownParams, withApproach } from '../../model/approach/params';
import type { ManeuverId, Slot } from '../../model/approach/types';
import { NumberInput } from '../NumberInput';
import { copy } from './copy';

const DEFAULT = '__default';
/**
 * The settings of ONE slot (Pick, Drop, Laden or Unladen): how it moves, which side it arrives from, and the distances. The maneuver list says in a line when to use each; "Exact values" holds the
 * numbers (the two handles on the map change the same two distances).
 */
export function SlotEditor({
  slot,
  editable,
  onChange,
}: {
  slot: Slot;
  editable: boolean;
  onChange(patch: Partial<Slot>): void;
}) {
  const t = copy;
  const [open, setOpen] = useState(false);
  const m = slot.maneuver ? t.maneuvers[slot.maneuver] : undefined;
  const items = [
    { id: DEFAULT, label: t.robotDefault },
    ...MANEUVERS.map((id) => ({ id: id as string, label: t.maneuvers[id].label })),
  ];
  const keys = shownParams(slot);
  const known = maneuverOf(slot.maneuver).params as string[];
  const hasSides = known.includes('inlane_dist') || known.includes('perpendicular_dist');
  return (
    <div className="flex flex-col gap-3 pl-1">
      <Select
        size="sm"
        label={t.maneuver}
        tooltip={t.maneuverHint}
        isDisabled={!editable}
        selectedKey={slot.maneuver ?? DEFAULT}
        onSelectionChange={(k) =>
          onChange({ maneuver: k === DEFAULT ? undefined : (k as ManeuverId), params: { ...slot.params } })
        }
        items={items}
        hint={m?.why}
      >
        {(item) => <Select.Item {...item} />}
      </Select>
      {hasSides && (
        <div className="flex flex-col gap-1.5">
          <Label tooltip={t.from.hint}>{t.from.label}</Label>
          <RadioGroup
            aria-label={t.from.label}
            isDisabled={!editable}
            value={approachOf(slot)}
            onChange={(v) => onChange({ params: withApproach(slot, v === 'behind' ? 'behind' : 'front') })}
            className="flex-row gap-6"
          >
            <RadioButton value="front" label={t.from.front} />
            <RadioButton value="behind" label={t.from.behind} />
          </RadioGroup>
        </div>
      )}
      {keys.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="flex w-fit items-center gap-1 text-xs font-medium text-tertiary hover:text-secondary"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            {t.advanced}
          </button>
          {open && (
            <div className="grid grid-cols-2 gap-3">
              {keys.map((k) => (
                <NumberInput
                  key={k}
                  label={(t.params as Record<string, string>)[k] ?? k}
                  tooltip={(t.paramHelp as Record<string, string>)[k]}
                  value={paramValue(slot, k as ParamKey)}
                  disabled={!editable}
                  onCommit={(v) => onChange({ params: { ...slot.params, [k]: v } })}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
