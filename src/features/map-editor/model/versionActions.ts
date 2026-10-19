import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { buildMapZip, download } from './exportMap';
import type { Viewing } from './pageParts';
import { mapVersionsStore } from './store';
import type { MapData } from './types';

/** What the header and the version dialogs do to the map's versions: start the draft, restore a version into it, publish it, and download the map as a zip for the Deployment Manager. */
export function versionActions(o: {
  id: string;
  map: { name: string; version: number };
  data: MapData;
  userName: string;
  setViewing(v: Viewing): void;
}) {
  const { id, map, data, userName, setViewing } = o;
  return {
    exportZip: async () => {
      try {
        download(await buildMapZip(map, data), `${map.name}.zip`);
        notify.success(copy.exportMap.done(map.name), copy.exportMap.doneBody, 'map-export');
      } catch {
        notify.error(copy.exportMap.failed, undefined, 'map-export');
      }
    },
    startDraft: () => {
      mapVersionsStore.getState().startDraft(id, userName);
      setViewing('draft');
      notify.info(copy.started, undefined, 'map-draft');
    },
    restore: (n: number) => {
      mapVersionsStore.getState().restoreToDraft(id, n, userName);
      setViewing('draft');
      notify.success(copy.historyPanel.restored(n), undefined, 'map-restore');
    },
    publish: () => {
      const n = mapVersionsStore.getState().publish(id, userName);
      if (n) {
        setViewing(n);
        notify.success(copy.publishDialog.published(n), map.name, 'map-publish');
      }
    },
  };
}
