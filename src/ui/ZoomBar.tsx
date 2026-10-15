import { Minus, Plus } from '@untitledui/icons';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { copy } from './copy';

/** Floating zoom control (Figma "Zoom control"): used by the 3D Live Floor and the Workflow canvas. */
export function ZoomBar({
  pct,
  onIn,
  onOut,
  onReset,
  canIn = true,
  canOut = true,
}: {
  pct: number;
  onIn: () => void;
  onOut: () => void;
  onReset?: () => void;
  canIn?: boolean;
  canOut?: boolean;
}) {
  return (
    <div className="float zoom" data-no-pan>
      <ButtonUtility size="xs" icon={Minus} tooltip={copy.zoom.out} isDisabled={!canOut} onPress={onOut} />
      <button className="zpct" title={onReset ? copy.zoom.reset : undefined} onClick={onReset}>
        {pct}%
      </button>
      <ButtonUtility size="xs" icon={Plus} tooltip={copy.zoom.in} isDisabled={!canIn} onPress={onIn} />
    </div>
  );
}
