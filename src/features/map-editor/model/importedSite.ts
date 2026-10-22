import type { SiteLayout } from '@/core/types';
import type { MapData } from './types';

/**
 * The "site" an imported map is drawn on: no walls or machines (the floor is the imported picture), only the bounds the editor needs to fit the view. The bounds are the picture's
 * rectangle in metres, or, with no picture, the box around the stations and the mapping path (at least 20 m).
 */
export function importedSite(name: string, data?: MapData): SiteLayout {
  const xs: number[] = [0],
    ys: number[] = [0];
  const l = data?.base?.levels[0];
  if (l) {
    xs.push(-l.originCol * l.res, (l.width - l.originCol) * l.res);
    ys.push(l.originRow * l.res, (l.originRow - l.height) * l.res);
  } else if (data) {
    for (const n of data.nodes) {
      xs.push(n.x);
      ys.push(n.y);
    }
    for (const [x, y] of data.path ?? []) {
      xs.push(x);
      ys.push(y);
    }
  }
  // a map with no floor picture (generated, or drawn by hand) is as big as what has been drawn on it
  for (const e of data?.model3d?.elements ?? []) {
    if ('points' in e)
      for (const [x, y] of e.points) {
        xs.push(x);
        ys.push(y);
      }
    else {
      xs.push(e.x - 1, e.x + 1);
      ys.push(e.y - 1, e.y + 1);
    }
  }
  const pad = 2;
  let minX = Math.min(...xs) - pad,
    maxX = Math.max(...xs) + pad,
    minY = Math.min(...ys) - pad,
    maxY = Math.max(...ys) + pad;
  if (maxX - minX < 20) {
    minX -= 10;
    maxX += 10;
  }
  if (maxY - minY < 20) {
    minY -= 10;
    maxY += 10;
  }
  return {
    schema: 1,
    siteId: 'imported',
    name,
    units: 'm',
    bounds: { minX, minY, maxX, maxY },
    floorPolygons: [],
    walls: [],
    pillars: [],
    zones: [],
    equipment: [],
    doors: [],
    labels: [],
  };
}
