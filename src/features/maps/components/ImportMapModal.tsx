import { useState } from 'react';
import { Map01 } from '@untitledui/icons';
import { FileListItemProgressBar, FileUploadDropZone } from '@/components/application/file-upload/file-upload-base';
import { ModalShell } from '@/components/modal/ModalShell';
import { notify } from '@/ui/toast';
import { readWithProgress } from '@/utils/readWithProgress';
import { copy } from '../copy';

/** File types accepted for a map import and the size limit. (Which formats the system really reads is not defined yet.) */
export const MAP_FILE_EXTENSIONS = ['.zip', '.map'];
export const MAP_FILE_MAX_BYTES = 50 * 1024 * 1024;
const mb = (b: number) => Math.round(b / 1024 / 1024);

function Body({ onOpenChange }: { onOpenChange(o: boolean): void }) {
  const t = copy.importMap;
  const types = MAP_FILE_EXTENSIONS.map((e) => e.slice(1).toUpperCase()).join(' / ');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const take = async (f: File) => {
    setError('');
    setFile(f);
    setProgress(0);
    if (!MAP_FILE_EXTENSIONS.some((e) => f.name.toLowerCase().endsWith(e))) {
      setFile(null);
      setError(`${t.errors.type}. ${t.errors.typeBody(MAP_FILE_EXTENSIONS.join(', '))}`);
      return;
    }
    if (f.size > MAP_FILE_MAX_BYTES) {
      setFile(null);
      setError(`${t.errors.size}. ${t.errors.sizeBody(mb(MAP_FILE_MAX_BYTES))}`);
      return;
    }
    await readWithProgress(f, setProgress);
  };
  const done = !!file && progress === 100;
  return (
    <ModalShell
      isOpen
      onOpenChange={onOpenChange}
      icon={Map01}
      title={t.title}
      subtitle={t.subtitle}
      secondary={{ label: t.back, onPress: () => onOpenChange(false) }}
      primary={{
        label: t.next,
        isDisabled: !done,
        onPress: () => {
          onOpenChange(false);
          notify.info(t.notDefined.title, t.notDefined.body, 'map-import');
        },
      }}
    >
      <div className="flex flex-col gap-3 pt-2">
        {!file && (
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
        {error && (
          <p role="alert" className="text-sm text-error-primary">
            {error}
          </p>
        )}
        {file && (
          <ul>
            <FileListItemProgressBar
              name={file.name}
              size={file.size}
              progress={progress}
              onDelete={() => {
                setFile(null);
                setProgress(0);
              }}
            />
          </ul>
        )}
      </div>
    </ModalShell>
  );
}
/** "Import" window: upload a map file with progress (same dropzone and file row as the material import). Mounted only while open. */
export const ImportMapModal = (p: { isOpen: boolean; onOpenChange(o: boolean): void }) =>
  p.isOpen ? <Body onOpenChange={p.onOpenChange} /> : null;
