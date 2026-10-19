import type { ReactNode } from 'react';
import { Button } from '@/components/base/buttons/button';
import { copy } from '../copy';

/** Top of the side panel in the 3D view: what can be done here (pick, Shift / Select multiple, delete) and a button back to the 2D view for drawing and routes. */
function View3dNotice({ onBack }: { onBack(): void }) {
  const t = copy.structure.view3d;
  return (
    <div className="flex flex-col items-start gap-2 border-b border-secondary px-4 py-3">
      <p className="text-xs text-secondary">{t.hint}</p>
      <Button size="sm" color="secondary" onPress={onBack}>
        {t.to2d}
      </Button>
    </div>
  );
}

/** The notice only exists in the 3D view. */
export const view3dNotice = (view: '2d' | '3d', onView: (v: '2d' | '3d') => void): ReactNode =>
  view === '3d' ? <View3dNotice onBack={() => onView('2d')} /> : undefined;
