import { useEffect, useState } from 'react';
import { services } from '@/services';
import type { MapBase, MapData } from '../../model/types';
import type { useViewport } from '../useViewport';

type Vp = ReturnType<typeof useViewport>;

/** The stored pictures of a map as object URLs (made when the map opens, freed when it closes or changes). Biggest first, like `base.levels`. */
function useUrls(base: MapBase | undefined) {
  const [urls, setUrls] = useState<string[]>([]);
  const key = base?.levels.map((l) => l.assetId).join(',') ?? '';
  useEffect(() => {
    if (!base) return;
    let live = true;
    const made: string[] = [];
    void Promise.all(
      base.levels.map(async (l) => {
        const a = await services().mapAssets.get(l.assetId);
        if (!a) return '';
        const u = URL.createObjectURL(new Blob([a.bytes as BlobPart], { type: a.mime }));
        made.push(u);
        return u;
      }),
    ).then((u) => live && setUrls(u));
    return () => {
      live = false;
      made.forEach(URL.revokeObjectURL);
      setUrls([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}

/**
 * The imported floor picture behind everything. Zoomed out it uses a smaller copy (one pixel of the copy is about one screen pixel), so a big map stays light on a tablet; zoomed in
 * it uses the full-size one. `vp.u` = metres per screen pixel.
 */
export function BaseLayer({ base, vp }: { base: MapBase; vp: Vp }) {
  const urls = useUrls(base);
  // the coarsest copy whose cell is still no bigger than a screen pixel
  let i = 0;
  base.levels.forEach((l, k) => {
    if (l.res <= vp.u * 1.01) i = k;
  });
  const l = base.levels[i],
    url = urls[i];
  if (!l || !url) return null;
  return (
    <image
      href={url}
      x={vp.X(-l.originCol * l.res)}
      y={vp.Y(l.originRow * l.res)}
      width={l.width * l.res}
      height={l.height * l.res}
      preserveAspectRatio="none"
      pointerEvents="none"
    />
  );
}

/** The path the robot drove while it mapped: a thin dashed guide for drawing roads. */
export function PathLayer({ path, vp }: { path: [number, number][]; vp: Vp }) {
  if (path.length < 2) return null;
  return (
    <polyline
      points={path.map(([x, y]) => `${vp.X(x)},${vp.Y(y)}`).join(' ')}
      fill="none"
      stroke="#14b8a6"
      strokeOpacity={0.7}
      strokeWidth={1.5}
      strokeDasharray="6 5"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  );
}

/** What an imported map shows behind its roads: the floor picture and the mapping path. */
export function ImportedLayers({ data, vp }: { data: Pick<MapData, 'base' | 'path'>; vp: Vp }) {
  return (
    <>
      {data.base && <BaseLayer base={data.base} vp={vp} />}
      {data.path && <PathLayer path={data.path} vp={vp} />}
    </>
  );
}
