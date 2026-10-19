import { Dotpoints01 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { Tooltip } from '@/components/base/tooltip/tooltip';
import { copy } from '../copy';
import { helpText } from '../help';

/** The Select multiple switch: one place in the Structure side panel, the same in the plan and in 3D. While it is on a click adds or removes an element and a drag on the floor draws a box. */
export function MultiToggle({ on, toggle }: { on: boolean; toggle(): void }) {
  return (
    <div className="border-b border-secondary px-4 py-3">
      <Tooltip title={copy.tools.multi} description={helpText('tool.multi')} placement="bottom" delay={500}>
        <Button
          size="sm"
          color={on ? 'primary' : 'secondary'}
          iconLeading={Dotpoints01}
          aria-pressed={on}
          onPress={toggle}
        >
          {copy.tools.multi}
        </Button>
      </Tooltip>
    </div>
  );
}
