import { Plus, Trash01 } from '@untitledui/icons';
import { Badge } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { Toggle } from '@/components/base/toggle/toggle';
import { cx } from '@/utils/cx';
import { removeNode, resolveNodes, setSlotOn, slotOf, slotsOn, updateSlot } from '../../model/approach/nodes';
import { useApproachFocus } from '../../model/approach/focus';
import { SLOTS, type Role, type Slot, type SlotId } from '../../model/approach/types';
import type { MapData, MapStation } from '../../model/types';
import { SlotEditor } from './SlotEditor';
import { Tip } from './Tip';
import { copy } from './copy';

/** Problems with how robots can reach a station, for the form and for Publish. */
export function nodeProblems(data: MapData, s: MapStation): { park: boolean; unpark: boolean } {
  const nodes = resolveNodes(data, s).map((r) => r.node);
  const any = (role: Role) => nodes.some((n) => slotsOn(n).some((id) => SLOTS[role].includes(id)));
  return { park: !any('park'), unpark: !any('unpark') };
}

/**
 * The Nodes section of a station: every node (at least one), where it sits, and for each of Park (Pick, Drop) and Unpark (Laden, Unladen) a switch and, when it is on, how the robot moves. The map
 * shows the chosen slot's path and two handles.
 */
export function NodesSection({
  station,
  data,
  editable,
  adding,
  onEdit,
  onAdd,
  onCancelAdd,
}: {
  station: MapStation;
  data: MapData;
  editable: boolean;
  adding: boolean;
  onEdit(fn: (m: MapData) => MapData, key?: string): void;
  onAdd(): void;
  onCancelAdd(): void;
}) {
  const t = copy;
  const focus = useApproachFocus();
  if (station.onLane !== false)
    return (
      <Section>
        <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-tertiary">{t.onLane}</p>
      </Section>
    );
  const nodes = resolveNodes(data, station);
  const problems = nodeProblems(data, station);
  return (
    <Section>
      {nodes.map((r) => {
        const on = slotsOn(r.node);
        return (
          <div key={r.node.id} className="flex flex-col gap-3 rounded-xl border border-secondary p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-primary">{t.node(r.index + 1)}</span>
              <Badge size="sm" color={r.auto ? 'gray' : 'brand'}>
                {r.auto ? t.auto : t.fixed}
              </Badge>
              <Tip text={r.auto ? t.autoHint : t.fixedHint} />
              {editable && nodes.length > 1 && (
                <Button
                  size="sm"
                  color="tertiary-destructive"
                  className="ml-auto"
                  iconLeading={Trash01}
                  aria-label={t.remove}
                  onPress={() => {
                    onEdit((m) => removeNode(m, station.id, r.index));
                    focus.clear();
                  }}
                />
              )}
            </div>
            {!r.at && <p className="text-xs text-warning-primary">{t.noLane}</p>}
            {!on.length && <p className="text-xs text-warning-primary">{t.unused}</p>}
            {(['park', 'unpark'] as Role[]).map((role) => (
              <div key={role} className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-wide text-tertiary uppercase">{t.roles[role]}</span>
                {SLOTS[role].map((id) => (
                  <SlotRow
                    key={id}
                    id={id}
                    slot={slotOf(r.node, id)}
                    editable={editable}
                    focused={focus.station === station.id && focus.node === r.index && focus.slot === id}
                    onFocus={(open) => (open ? focus.set(station.id, r.index, id) : focus.clear())}
                    onToggle={(v) => onEdit((m) => setSlotOn(m, station.id, r.index, id, v))}
                    onChange={(patch) =>
                      onEdit(
                        (m) => updateSlot(m, station.id, r.index, id, patch),
                        `slot:${station.id}:${r.index}:${id}`,
                      )
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        );
      })}
      {problems.park && <p className="text-xs text-warning-primary">{t.noPark}</p>}
      {problems.unpark && <p className="text-xs text-warning-primary">{t.noUnpark}</p>}
      {editable && (
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            color={adding ? 'primary' : 'secondary'}
            iconLeading={Plus}
            onPress={adding ? onCancelAdd : onAdd}
          >
            {adding ? t.cancel : t.add}
          </Button>
          {adding && (
            <p className="rounded-lg bg-brand-secondary px-3 py-2 text-xs text-brand-secondary">{t.addHint}</p>
          )}
        </div>
      )}
    </Section>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-label={copy.title}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-primary">{copy.title}</h3>
        <Tip text={copy.intro} />
      </div>
      {children}
    </section>
  );
}

function SlotRow({
  id,
  slot,
  editable,
  focused,
  onFocus,
  onToggle,
  onChange,
}: {
  id: SlotId;
  slot: Slot | undefined;
  editable: boolean;
  focused: boolean;
  onFocus(open: boolean): void;
  onToggle(on: boolean): void;
  onChange(patch: Partial<Slot>): void;
}) {
  return (
    <div className={cx('flex flex-col gap-2 rounded-lg px-2 py-1.5', focused && 'bg-brand-secondary')}>
      <div className="flex items-center gap-2">
        <Toggle
          size="sm"
          aria-label={copy.slots[id]}
          label={copy.slots[id]}
          isSelected={!!slot}
          isDisabled={!editable}
          onChange={(v) => {
            onToggle(v);
            onFocus(v);
          }}
        />
        <Tip text={copy.slotHelp[id]} />
        {slot && (
          <button
            type="button"
            className="ml-auto text-xs font-medium text-brand-secondary hover:underline"
            aria-pressed={focused}
            onClick={() => onFocus(!focused)}
          >
            {slot.maneuver ? copy.maneuvers[slot.maneuver].label : copy.robotDefault}
          </button>
        )}
      </div>
      {slot && focused && <SlotEditor slot={slot} editable={editable} onChange={onChange} />}
    </div>
  );
}
