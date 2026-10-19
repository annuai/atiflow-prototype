import type { ReactNode } from 'react';
import type { WallSource } from '@/features/map-3d';
import { DwgPanel } from '@/features/map-3d';
import type { MapData } from '../model/types';

/** The DWG layout panel under the Structure panel in the 3D view: choose, align and save the layout into the draft, and switch the walls to it. */
export function DwgFooter({
  data,
  versionId,
  isDraft,
  onEditDraft,
  edit,
  onSource,
}: {
  data: MapData;
  versionId: string;
  isDraft: boolean;
  onEditDraft(): void;
  edit(fn: (d: MapData) => MapData): void;
  onSource(s: WallSource): void;
}) {
  return (
    <DwgPanel
      key={versionId}
      data={data}
      canEdit={isDraft}
      onEditDraft={onEditDraft}
      onSave={(dwg) => {
        edit((d) => {
          const { dwg: _old, ...rest } = d;
          return dwg ? { ...rest, dwg } : rest;
        });
        onSource(dwg ? 'dwg' : 'lidar');
      }}
    />
  );
}

/** The footer of the side panel: the DWG panel in the 3D view of a map that has a lidar estimate to align it with, else nothing. */
export const dwgFooter = (
  view: '2d' | '3d',
  data: MapData,
  versionId: string,
  isDraft: boolean,
  onEditDraft: () => void,
  edit: (fn: (d: MapData) => MapData) => void,
  onSource: (s: WallSource) => void,
): ReactNode =>
  view === '3d' && data.structure ? (
    <DwgFooter
      data={data}
      versionId={versionId}
      isDraft={isDraft}
      onEditDraft={onEditDraft}
      edit={edit}
      onSource={onSource}
    />
  ) : undefined;
