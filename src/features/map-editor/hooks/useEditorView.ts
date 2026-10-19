import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Which view the editor shows (the plan, or the structure in 3D: `?view=3d` opens it), and whether Select multiple is on. */
export function useEditorView(onEnter3d: () => void) {
  const [params] = useSearchParams();
  const [view, setView] = useState<'2d' | '3d'>(params.get('view') === '3d' ? '3d' : '2d');
  const [multi, setMulti] = useState(false);
  // (opening in 3D, or switching to it, puts the editor on the Structure module with the select tool)
  useEffect(() => {
    if (view === '3d') onEnter3d();
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    view,
    setView,
    multi,
    toggleMulti: () => setMulti((v) => !v),
  };
}
