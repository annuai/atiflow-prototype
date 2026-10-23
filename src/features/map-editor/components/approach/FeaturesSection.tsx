import { Select } from '@/components/base/select/select';
import { Toggle } from '@/components/base/toggle/toggle';
import { withoutThreePointTurn } from '@/data/robotTypes';
import type { ThreePointTurn } from '../../model/approach/types';
import type { MapStation } from '../../model/types';
import { NumberInput } from '../NumberInput';
import { Tip } from './Tip';
import { copy } from './copy';

const START: ThreePointTurn = { startDirection: 'left', startAction: 'forward', aisleWidth: 4, aisleLength: 6 };
/**
 * Things a station asks of the robot that only some robots can do (today: a three-point turn). They are switches of the station, not tags: which robots can do them is robot configuration, and the
 * form names the ones that cannot (they fall back to turning on the spot).
 */
export function FeaturesSection({
  station,
  editable,
  onChange,
}: {
  station: MapStation;
  editable: boolean;
  onChange(next: MapStation['features']): void;
}) {
  const t = copy.features;
  const turn = station.features?.threePointTurn;
  const sel = (label: string, value: string, items: [string, string][], set: (v: string) => void) => (
    <Select
      size="sm"
      label={label}
      isDisabled={!editable}
      selectedKey={value}
      onSelectionChange={(k) => set(String(k))}
      items={items.map(([id, l]) => ({ id, label: l }))}
    >
      {(item) => <Select.Item {...item} />}
    </Select>
  );
  return (
    <section className="flex flex-col gap-3" aria-label={t.title}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-primary">{t.title}</h3>
        <Tip text={t.intro} />
      </div>
      <div className="flex items-center gap-2">
        <Toggle
          size="sm"
          label={t.threePoint.title}
          isSelected={!!turn}
          isDisabled={!editable}
          onChange={(v) =>
            onChange(
              v ? { ...station.features, threePointTurn: START } : { ...station.features, threePointTurn: undefined },
            )
          }
        />
        <Tip text={t.threePoint.hint} />
      </div>
      {turn && (
        <div className="flex flex-col gap-3 pl-1">
          <div className="grid grid-cols-2 gap-3">
            {sel(
              t.threePoint.direction,
              turn.startDirection,
              [
                ['left', t.threePoint.left],
                ['right', t.threePoint.right],
              ],
              (v) =>
                onChange({
                  ...station.features,
                  threePointTurn: { ...turn, startDirection: v === 'right' ? 'right' : 'left' },
                }),
            )}
            {sel(
              t.threePoint.action,
              turn.startAction,
              [
                ['forward', t.threePoint.forward],
                ['reverse', t.threePoint.reverse],
              ],
              (v) =>
                onChange({
                  ...station.features,
                  threePointTurn: { ...turn, startAction: v === 'reverse' ? 'reverse' : 'forward' },
                }),
            )}
            <NumberInput
              label={t.threePoint.width}
              tooltip={t.threePoint.boxHint}
              value={turn.aisleWidth}
              disabled={!editable}
              onCommit={(v) =>
                onChange({ ...station.features, threePointTurn: { ...turn, aisleWidth: Math.max(0, v) } })
              }
            />
            <NumberInput
              label={t.threePoint.length}
              tooltip={t.threePoint.boxHint}
              value={turn.aisleLength}
              disabled={!editable}
              onCommit={(v) =>
                onChange({ ...station.features, threePointTurn: { ...turn, aisleLength: Math.max(0, v) } })
              }
            />
          </div>
          <p className="text-xs text-tertiary">
            {t.threePoint.fallback(
              withoutThreePointTurn()
                .map((r) => r.label)
                .join(', '),
            )}
          </p>
        </div>
      )}
    </section>
  );
}
