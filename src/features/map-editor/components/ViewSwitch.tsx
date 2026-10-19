import { ButtonGroup, ButtonGroupItem } from '@/components/base/button-group/button-group';
import { copy } from '../copy';

/** 2D | 3D, in the top right corner of the canvas (both views show it in the same place). */
export function ViewSwitch({ view, onView }: { view: '2d' | '3d'; onView(v: '2d' | '3d'): void }) {
  return (
    <div className="absolute top-3 right-3 z-10" onPointerDown={(e) => e.stopPropagation()}>
      <ButtonGroup
        size="sm"
        aria-label={copy.viewSwitch.label}
        selectedKeys={[view]}
        onSelectionChange={(k) => {
          const x = [...k][0];
          if (x) onView(x as '2d' | '3d');
        }}
      >
        <ButtonGroupItem id="2d">{copy.viewSwitch.d2}</ButtonGroupItem>
        <ButtonGroupItem id="3d">{copy.viewSwitch.d3}</ButtonGroupItem>
      </ButtonGroup>
    </div>
  );
}
