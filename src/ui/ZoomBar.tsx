import { Minus, Plus } from '@untitledui/icons';
import { ButtonUtility } from '@/components/base/buttons/button-utility';

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
      <ButtonUtility size="xs" icon={Minus} tooltip="Zoom out" isDisabled={!canOut} onPress={onOut} />
      <button className="zpct" title={onReset ? 'Reset to 100%' : undefined} onClick={onReset}>
        {pct}%
      </button>
      <ButtonUtility size="xs" icon={Plus} tooltip="Zoom in" isDisabled={!canIn} onPress={onIn} />
    </div>
  );
}
