import type { RobotType } from '@/data/robotTypes';
import { copy } from '../copy';
import { RobotTile } from './RobotTile';

/** Step 1 of a custom trip: the robot types the fleet has on its floor, as big tiles with how many there are and how many are free now (when the floor reports). */
export function RobotStep({
  types,
  selected,
  free,
  onSelect,
}: {
  types: { type: RobotType; count: number }[];
  selected: string;
  /** free robots of a type right now; left out until the floor reports */
  free?: (typeId: string) => number;
  onSelect(typeId: string): void;
}) {
  return (
    <section aria-label={copy.book.robot} className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-primary">{copy.book.robotHint}</h2>
      <div
        role="radiogroup"
        aria-label={copy.book.robot}
        className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(200px,100%),1fr))]"
      >
        {types.map(({ type, count }) => (
          <RobotTile
            key={type.id}
            label={type.label}
            picture={type.illustration}
            count={copy.book.total(count)}
            free={free ? { text: copy.book.free(free(type.id)), any: free(type.id) > 0 } : undefined}
            selected={selected === type.id}
            onSelect={() => onSelect(type.id)}
          />
        ))}
      </div>
    </section>
  );
}
