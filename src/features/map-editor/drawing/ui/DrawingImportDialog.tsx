import { FileUploadDropZone } from '@/components/application/file-upload/file-upload-base';
import { Upload01 } from '@untitledui/icons';
import { ModalShell } from '@/components/modal/ModalShell';
import { copy } from '../copy';
import type { MapData } from '../../model/types';
import { AlignStep } from './AlignStep';
import { ReviewStep } from './ReviewStep';
import { useDrawingImport, type Phase } from './useDrawingImport';

const ACCEPT = '.dxf,.dwg,.ai';
const MAX_MB = 450;

/** The footer buttons of each step. */
function footer(
  phase: Phase,
  f: { cancel(): void; again(): void; back(): void; next(): void; importNow(): void; empty: boolean },
) {
  const t = copy;
  if (phase === 'align')
    return {
      secondary: { label: t.back, onPress: f.back },
      primary: { label: t.align.import, isDisabled: f.empty, onPress: f.importNow },
    };
  if (phase === 'review' || phase === 'building')
    return {
      secondary: { label: t.another, onPress: f.again, isDisabled: phase === 'building' },
      primary: { label: t.next, isLoading: phase === 'building', onPress: f.next },
    };
  return { secondary: { label: t.cancel, onPress: f.cancel }, primary: { label: t.next, isDisabled: true } };
}

function Body({
  data,
  onApply,
  onOpenChange,
}: {
  data: MapData;
  onApply(fn: (d: MapData) => MapData): void;
  onOpenChange(o: boolean): void;
}) {
  const t = copy;
  const s = useDrawingImport(data, onApply, () => onOpenChange(false));
  const { phase, built, summary } = s;
  const buttons = footer(phase, {
    cancel: () => onOpenChange(false),
    again: () => s.setPhase('pick'),
    back: () => s.setPhase('review'),
    next: () => void s.goAlign(),
    importNow: s.importNow,
    empty: s.total === 0,
  });
  const notes = built ? Object.entries(built.notes).filter(([k]) => k !== 'outside') : [];
  const noteText = (k: string, n: number) => (t.align.notes as Record<string, (n: number) => string>)[k]?.(n);
  return (
    <ModalShell
      isOpen
      onOpenChange={onOpenChange}
      icon={Upload01}
      title={t.title}
      subtitle={phase === 'pick' || phase === 'reading' ? t.subtitle : s.name}
      size={phase === 'pick' || phase === 'reading' ? 'md' : 'xl'}
      {...buttons}
    >
      {phase === 'pick' && (
        <div className="flex flex-col gap-3 pt-2">
          <FileUploadDropZone
            accept={ACCEPT}
            maxSize={MAX_MB * 1024 * 1024}
            hint={t.dropHint(t.types, MAX_MB)}
            onDropFiles={(fl) => void s.take(fl[0])}
            onDropUnacceptedFiles={() => s.setError(t.errors.unsupported)}
          />
        </div>
      )}
      {phase === 'reading' && (
        <p role="status" className="py-10 text-center text-sm text-tertiary">
          {t.reading}
        </p>
      )}
      {s.error && (
        <p role="alert" className="pt-3 text-sm text-error-primary">
          {s.error}
        </p>
      )}
      {(phase === 'review' || phase === 'building') && summary && (
        <ReviewStep
          summary={summary}
          layers={s.layers}
          rules={s.rules}
          unit={s.unit}
          onUnit={s.changeUnit}
          onRule={s.setRule}
          edited={s.edited}
        />
      )}
      {phase === 'align' && built && (
        <>
          <AlignStep
            built={built}
            context={s.context}
            t={s.place}
            onT={s.setPlace}
            area={s.area}
            clipOn={s.clipOn}
            onClip={s.setClipOn}
            replace={s.replace}
            onReplace={s.setReplace}
            earlier={s.earlier}
            counts={s.counts}
            tried={s.tried}
            onTried={() => s.setTried(true)}
          />
          {notes.length > 0 && (
            <ul className="pt-3 text-xs text-tertiary">
              {notes.map(([k, n]) => (
                <li key={k}>{noteText(k, n)}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </ModalShell>
  );
}

/** "Import drawing": a DXF, converted DWG or Illustrator file laid over the map and turned into walls, machines, pillars, doors and work areas of the draft. Mounted only while open. */
export const DrawingImportDialog = (p: {
  isOpen: boolean;
  onOpenChange(o: boolean): void;
  data: MapData;
  onApply(fn: (d: MapData) => MapData): void;
}) => (p.isOpen ? <Body data={p.data} onApply={p.onApply} onOpenChange={p.onOpenChange} /> : null);
