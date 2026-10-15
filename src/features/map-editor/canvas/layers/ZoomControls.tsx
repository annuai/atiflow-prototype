import { Home01, Minus, Plus } from '@untitledui/icons';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { text } from '../../text';
import type { useViewport } from '../useViewport';

/** Zoom in, zoom out and fit-the-whole-map buttons in a corner of the map. */
export function ZoomControls({ vp }: { vp: ReturnType<typeof useViewport> }) {
  return (
    <div
      className="map-zoom absolute right-3 bottom-3 flex flex-col gap-1 rounded-lg bg-primary p-1 shadow-sm ring-1 ring-secondary"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <ButtonUtility
        size="sm"
        color="tertiary"
        icon={Plus}
        tooltip={text.zoom.in}
        aria-label={text.zoom.in}
        onPress={() => vp.zoomAt(1.5, undefined, undefined, true)}
      />
      <ButtonUtility
        size="sm"
        color="tertiary"
        icon={Minus}
        tooltip={text.zoom.out}
        aria-label={text.zoom.out}
        onPress={() => vp.zoomAt(1 / 1.5, undefined, undefined, true)}
      />
      <ButtonUtility
        size="sm"
        color="tertiary"
        icon={Home01}
        tooltip={text.zoom.fit}
        aria-label={text.zoom.fit}
        onPress={vp.reset}
      />
    </div>
  );
}
