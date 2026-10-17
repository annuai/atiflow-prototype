import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import type { MapData } from '@/features/map-editor';
import {
  alignmentScore,
  autoAlign,
  IDENTITY,
  parseLayout,
  samplePoints,
  type Layout,
  type Similarity,
} from '@/features/map-import';
import { notify } from '@/ui/toast';
import { copy } from './copy';
import { AlignPreview } from './AlignPreview';

type Dwg = NonNullable<MapData['dwg']>;
const num = (s: string, fallback: number) => (Number.isFinite(parseFloat(s)) ? parseFloat(s) : fallback);
const r = (v: number, d = 3) => String(Math.round(v * 10 ** d) / 10 ** d);

/** The DWG layout laid over the lidar walls: choose the layout file, align it (by hand or automatically), see the match, save it into the draft. */
export function DwgPanel({
  data,
  canEdit,
  onEditDraft,
  onSave,
}: {
  data: MapData;
  canEdit: boolean;
  onEditDraft(): void;
  onSave(dwg: Dwg | undefined): void;
}) {
  const t = copy.view3d.dwgSection;
  const file = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(data.dwg?.name ?? '');
  const [layout, setLayout] = useState<Layout | null>(data.dwg?.layout ?? null);
  const [tr, setTr] = useState<Similarity>(data.dwg?.transform ?? IDENTITY);
  const [error, setError] = useState('');
  const lidar = data.structure?.walls ?? [];
  const pts = useMemo(() => (layout ? samplePoints(layout.walls) : []), [layout]);
  const match = layout ? Math.round(alignmentScore(pts, lidar, tr) * 100) : 0;

  const load = async (f: File) => {
    setError('');
    try {
      const l = parseLayout(JSON.parse(await f.text()));
      if (!l) throw new Error('layout');
      setLayout(l);
      setName(f.name);
      setTr(IDENTITY);
    } catch {
      setError(t.invalid);
    }
  };
  const field = (label: string, value: string, set: (v: number) => void) => (
    <Input
      size="sm"
      label={label}
      type="number"
      value={value}
      isDisabled={!canEdit || !layout}
      onChange={(v) => set(num(v, 0))}
    />
  );
  return (
    <section className="flex flex-col gap-3 border-t border-secondary pt-4">
      <h3 className="text-sm font-semibold text-primary">{t.title}</h3>
      <p className="text-xs text-tertiary">{t.hint}</p>
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void load(f);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" color="secondary" isDisabled={!canEdit} onPress={() => file.current?.click()}>
          {layout ? t.replace : t.choose}
        </Button>
        {layout && (
          <Button
            size="sm"
            color="tertiary"
            isDisabled={!canEdit}
            onPress={() => {
              setLayout(null);
              setName('');
              setTr(IDENTITY);
              onSave(undefined);
            }}
          >
            {t.remove}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-error-primary">
          {error}
        </p>
      )}
      {layout && (
        <>
          <AlignPreview lidar={lidar} layout={layout} t={tr} label={t.preview} />
          <p className="text-xs text-tertiary">{t.preview}</p>
          <div className="grid grid-cols-2 gap-3">
            {field(t.offsetX, r(tr.dx), (v) => setTr({ ...tr, dx: v }))}
            {field(t.offsetY, r(tr.dy), (v) => setTr({ ...tr, dy: v }))}
            {field(t.rotation, r((tr.rot * 180) / Math.PI, 2), (v) => setTr({ ...tr, rot: (v * Math.PI) / 180 }))}
            {field(t.scale, r(tr.scale, 4), (v) => setTr({ ...tr, scale: v || 1 }))}
          </div>
          <p className="text-xs font-medium text-secondary" aria-live="polite">
            {t.match(match)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              color="secondary"
              isDisabled={!canEdit || !lidar.length}
              onPress={() => setTr(autoAlign(layout.walls, lidar).t)}
            >
              {t.auto}
            </Button>
            <Button
              size="sm"
              color="primary"
              isDisabled={!canEdit}
              onPress={() => {
                onSave({ name, layout, transform: tr });
                notify.success(t.saved, undefined, 'dwg-saved');
              }}
            >
              {t.save}
            </Button>
          </div>
        </>
      )}
      {!canEdit && (
        <div className="flex flex-col gap-2 text-xs text-tertiary">
          {copy.view3d.readOnly}
          <Button size="sm" color="secondary" className="w-fit" onPress={onEditDraft}>
            {copy.view3d.editDraft}
          </Button>
        </div>
      )}
    </section>
  );
}
