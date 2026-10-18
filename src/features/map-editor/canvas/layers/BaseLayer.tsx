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
function PathLayer({ path, vp }: { path: [number, number][]; vp: Vp }) {
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

/**
 * The origin like a 3D program shows it: a red arrow along X (east) and a green arrow along Y (north), each labelled, and the point itself with its coordinates. Pixel sized, so it stays
 * the same on screen at any zoom. Every map has one: it is the (0, 0) all coordinates are measured from.
 */
function OriginGizmo({ vp }: { vp: Vp }) {
  const ox = vp.X(0),
    oy = vp.Y(0),
    u = vp.u;
  const len = 56 * u,
    head = 9 * u,
    fs = 12 * u;
  const arrow = (dx: number, dy: number, color: string, label: string) => {
    const tx = ox + dx * len,
      ty = oy + dy * len;
    const px = -dy,
      py = dx; // across the arrow
    const bx = tx - dx * head,
      by = ty - dy * head;
    return (
      <g>
        <line x1={ox} y1={oy} x2={bx} y2={by} stroke={color} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        <polygon
          points={`${tx},${ty} ${bx + px * head * 0.4},${by + py * head * 0.4} ${bx - px * head * 0.4},${by - py * head * 0.4}`}
          fill={color}
        />
        <text
          x={tx + dx * 8 * u + px * 0}
          y={ty + dy * 8 * u + (dy ? 0 : fs * 0.35)}
          fontSize={fs}
          fontWeight={700}
          fill={color}
          textAnchor={dx ? 'start' : 'middle'}
          stroke="#fff"
          strokeWidth={3 * u}
          paintOrder="stroke"
        >
          {label}
        </text>
      </g>
    );
  };
  return (
    <g pointerEvents="none" aria-hidden>
      {arrow(1, 0, '#ef4444', 'X')}
      {arrow(0, -1, '#22c55e', 'Y')}
      <circle
        cx={ox}
        cy={oy}
        r={3.5 * u}
        fill="#fff"
        stroke="#334155"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={ox - 6 * u}
        y={oy + 15 * u}
        fontSize={fs * 0.9}
        fill="#334155"
        textAnchor="end"
        stroke="#fff"
        strokeWidth={3 * u}
        paintOrder="stroke"
      >
        0, 0
      </text>
    </g>
  );
}

/** What sits behind everything on the map: an imported floor picture and mapping path, and the origin. */
export function ImportedLayers({ data, vp }: { data: Pick<MapData, 'base' | 'path'>; vp: Vp }) {
  return (
    <>
      {data.base && <BaseLayer base={data.base} vp={vp} />}
      {data.path && <PathLayer path={data.path} vp={vp} />}
      <OriginGizmo vp={vp} />
    </>
  );
}
