import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Map01 } from '@untitledui/icons';
import { FileUploadDropZone } from '@/components/application/file-upload/file-upload-base';
import { FormField } from '@/components/form/FormField';
import { ModalShell } from '@/components/modal/ModalShell';
import { useAuth } from '@/features/auth';
import { importInWorker, ImportError, type ImportWarning, type PreparedImport } from '@/features/map-import';
import { useMapData } from '@/features/workflow-builder';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { createImportedMap } from '../model/importMap';
import { mapNameError } from '../model/maps';
import { DEFAULT_ROUTING, ROUTING_VERSIONS } from '../model/routing';
import { ImportPreview } from './ImportPreview';
import { RoutingVersionPicker } from './RoutingVersionPicker';

/** The map folder as a zip, and the size limit. (More formats = more importers in the map-import feature.) */
const MAP_FILE_EXTENSIONS = ['.zip'];
const MAP_FILE_MAX_BYTES = 50 * 1024 * 1024;
const mb = (b: number) => Math.round(b / 1024 / 1024);

type Step =
  | { id: 'pick' }
  | { id: 'reading' }
  | { id: 'review'; file: File; zip: Uint8Array; prepared: PreparedImport }
  | { id: 'saving'; file: File; zip: Uint8Array; prepared: PreparedImport };

/** The routing version a file asks for ("v5" -> the v5 choice), or the default one. */
const routingFor = (v: string | null) => ROUTING_VERSIONS.find((r) => r.id === v?.toLowerCase())?.id ?? DEFAULT_ROUTING;

function Body({ onOpenChange }: { onOpenChange(o: boolean): void }) {
  const t = copy.importMap;
  const navigate = useNavigate();
  const user = useAuth((s) => s.user)!;
  const taken = useMapData()?.live.stations.map((s) => s.id) ?? [];
  const types = MAP_FILE_EXTENSIONS.map((e) => e.slice(1).toUpperCase()).join(' / ');
  const [step, setStep] = useState<Step>({ id: 'pick' });
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [routing, setRouting] = useState(DEFAULT_ROUTING);
  const [nameError, setNameError] = useState('');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []); // closing the dialog cancels a running import

  const take = async (f: File) => {
    setError('');
    if (!MAP_FILE_EXTENSIONS.some((e) => f.name.toLowerCase().endsWith(e))) {
      setError(`${t.errors.type}. ${t.errors.typeBody(MAP_FILE_EXTENSIONS.join(', '))}`);
      return;
    }
    if (f.size > MAP_FILE_MAX_BYTES) {
      setError(`${t.errors.size}. ${t.errors.sizeBody(mb(MAP_FILE_MAX_BYTES))}`);
      return;
    }
    setStep({ id: 'reading' });
    abort.current = new AbortController();
    try {
      const zip = new Uint8Array(await f.arrayBuffer());
      const prepared = await importInWorker(zip.slice(), {}, abort.current.signal); // a copy: the worker takes its own
      setName(prepared.map.name);
      setRouting(routingFor(prepared.map.version));
      setNameError('');
      setStep({ id: 'review', file: f, zip, prepared });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      const read = t.errors.read as Record<string, string>;
      setError(e instanceof ImportError ? (read[e.code] ?? t.errors.unknown) : t.errors.unknown);
      setStep({ id: 'pick' });
    }
  };

  const save = async () => {
    if (step.id !== 'review') return;
    const problem = mapNameError('', name);
    if (problem) return setNameError(problem);
    setStep({ ...step, id: 'saving' });
    try {
      const id = await createImportedMap(step.prepared, step.zip, {
        name,
        routing: ROUTING_VERSIONS.find((r) => r.id === routing)!.version,
        by: user.name,
        fileName: step.file.name,
        taken,
      });
      onOpenChange(false);
      notify.success(t.done.title(name.trim()), t.done.body, 'map-import');
      navigate(`/configurator/maps/${id}`);
    } catch {
      setError(t.errors.unknown);
      setStep({ ...step, id: 'review' });
    }
  };

  const review = step.id === 'review' || step.id === 'saving' ? step : null;
  const m = review?.prepared.map;
  const lvl = review?.prepared.levels[0];
  const warnText = (w: ImportWarning) =>
    (t.warnings as Record<string, (a: Record<string, string | number>) => string>)[w.code]?.(w.args ?? {}) ?? w.code;
  return (
    <ModalShell
      isOpen
      onOpenChange={onOpenChange}
      icon={Map01}
      title={t.title}
      subtitle={review ? t.reviewSubtitle : t.subtitle}
      size={review ? 'lg' : 'md'}
      secondary={
        review
          ? { label: t.another, onPress: () => setStep({ id: 'pick' }), isDisabled: step.id === 'saving' }
          : { label: t.back, onPress: () => onOpenChange(false) }
      }
      primary={{ label: t.next, isDisabled: !review, isLoading: step.id === 'saving', onPress: save }}
    >
      <div className="flex flex-col gap-4 pt-2">
        {step.id === 'pick' && (
          <FileUploadDropZone
            accept={MAP_FILE_EXTENSIONS.join(',')}
            maxSize={MAP_FILE_MAX_BYTES}
            hint={t.dropHint(types, mb(MAP_FILE_MAX_BYTES))}
            onDropFiles={(fl) => take(fl[0])}
            onDropUnacceptedFiles={() =>
              setError(`${t.errors.type}. ${t.errors.typeBody(MAP_FILE_EXTENSIONS.join(', '))}`)
            }
          />
        )}
        {step.id === 'reading' && (
          <p role="status" className="py-10 text-center text-sm text-tertiary">
            {t.reading}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-error-primary">
            {error}
          </p>
        )}
        {review && m && (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <FormField
                def={{ key: 'name', label: t.name, control: 'text', required: true }}
                value={name}
                onChange={(v) => {
                  setName(String(v));
                  setNameError('');
                }}
                error={nameError}
                fleets={[]}
              />
              <RoutingVersionPicker
                label={t.version}
                value={routing}
                onChange={setRouting}
                hint={m.version ? t.versionFromFile(m.version) : undefined}
              />
            </div>
            <div className="flex flex-col gap-3">
              <ImportPreview prepared={review.prepared} />
              <dl className="text-sm text-secondary">
                <p className="mb-1 font-semibold text-primary">{t.found.title}</p>
                <dd>{t.found.stations(m.stations.length)}</dd>
                <dd>
                  {lvl
                    ? t.found.floor(Math.round(lvl.width * lvl.res), Math.round(lvl.height * lvl.res))
                    : t.found.noFloor}
                </dd>
                {m.roads.length > 0 && <dd>{t.found.roads(m.roads.length)}</dd>}
                {m.gates.length > 0 && <dd>{t.found.gates(m.gates.length)}</dd>}
                {m.stagingAreas.length > 0 && <dd>{t.found.areas(m.stagingAreas.length)}</dd>}
                {m.path.length > 0 && <dd>{t.found.path(m.path.length)}</dd>}
                {m.stats.removedSpecks > 0 && <dd>{t.found.cleaned(m.stats.removedSpecks)}</dd>}
              </dl>
              <ul className="flex flex-col gap-1.5">
                {m.warnings.map((w) => (
                  <li key={w.code + JSON.stringify(w.args)} className="flex gap-2 text-xs text-tertiary">
                    <AlertTriangle
                      className={
                        w.level === 'warn' ? 'mt-px size-4 shrink-0 text-warning-primary' : 'mt-px size-4 shrink-0'
                      }
                    />
                    {warnText(w)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
/** "Import" window: drop a map folder (zip), see what was found and choose the map version, then it becomes a draft map in the Map Editor. Mounted only while open. */
export const ImportMapModal = (p: { isOpen: boolean; onOpenChange(o: boolean): void }) =>
  p.isOpen ? <Body onOpenChange={p.onOpenChange} /> : null;
