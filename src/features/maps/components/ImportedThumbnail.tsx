import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/skeleton/Skeleton';
import { draftOf, latestOf, useMapVersions } from '@/features/map-editor';
import { services } from '@/services';
import { cx } from '@/utils/cx';
import { t } from '../text';

/** The picture of an imported map: its smallest stored floor image with the stations that have a position. The editor's version (draft, else latest) is shown. */
export function ImportedThumbnail({ mapId, className }: { mapId: string; className?: string }) {
  const history = useMapVersions((s) => s.byMap[mapId]);
  const data = (draftOf(history) ?? latestOf(history))?.data;
  const level = data?.base?.levels[data.base.levels.length - 1];
  const [url, setUrl] = useState('');
  const assetId = level?.assetId;
  useEffect(() => {
    if (!assetId) return;
    let live = true,
      made = '';
    void services()
      .mapAssets.get(assetId)
      .then((a) => {
        if (!a || !live) return;
        made = URL.createObjectURL(new Blob([a.bytes as BlobPart], { type: a.mime }));
        setUrl(made);
      });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [assetId]);
  if (!data || !level) return <div className={cx('bg-[#f4f7f6]', className)} />;
  if (!url) return <Skeleton className={cx('rounded-none', className)} />;
  const w = level.width * level.res,
    h = level.height * level.res,
    x = -level.originCol * level.res,
    y = -level.originRow * level.res;
  const r = Math.max(w, h) / 90;
  return (
    <svg
      role="img"
      aria-label={t.maps.map}
      viewBox={`${x} ${y} ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      className={cx('block bg-[#f4f7f6]', className)}
    >
      <image href={url} x={x} y={y} width={w} height={h} preserveAspectRatio="none" />
      {data.stations
        .filter((s) => !s.unplaced)
        .map((s) => {
          const n = data.nodes.find((q) => q.id === s.nodeId);
          return n ? (
            <circle key={s.id} cx={n.x} cy={-n.y} r={r} fill="#f59e0b" stroke="#fff" strokeWidth={r * 0.3} />
          ) : null;
        })}
    </svg>
  );
}
