import { useMemo } from 'react';
import { Viewport3d, navOf, siteOf } from '@/features/map-3d';
import { ViewSwitch } from './ViewSwitch';
import { pickElement, selectIds } from '../model/structure/select';
import type { MapData, Selection } from '../model/types';

/**
 * The map's structure in 3D, live, in the editor's middle: the same draft, selection and side panel as the plan. Click picks an element, Shift or Select multiple (in the side panel) adds to the selection, a drag
 * with either draws a box. Drawing and moving are done in the plan; here things are looked at, picked, coloured, sized and deleted.
 */
export function Stage3d({
  name,
  data,
  selection,
  onSelection,
  multi,
  onView,
}: {
  name: string;
  data: MapData;
  selection: Selection;
  onSelection(sel: Selection): void;
  multi: boolean;
  onView(v: '2d' | '3d'): void;
}) {
  const site = useMemo(() => siteOf(name, data), [name, data]);
  const nav = useMemo(() => navOf(data), [data]);
  const ids = selection?.kind === 'element' ? (selection.ids ?? [selection.id]) : [];
  return (
    <div className="relative min-h-[360px] min-w-0 flex-1">
      <Viewport3d
        site={site}
        nav={nav}
        selectedIds={ids}
        multi={multi}
        onPick={(id, additive) =>
          onSelection(id ? pickElement(selection, id, additive || multi) : additive || multi ? selection : null)
        }
        onBox={(boxed, additive) => onSelection(selectIds(selection, boxed, additive || multi))}
      />
      <ViewSwitch view="3d" onView={onView} />
    </div>
  );
}
