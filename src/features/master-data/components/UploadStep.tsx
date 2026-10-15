import { useState } from 'react';
import { AlertCircle, Download01 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { FileListItemProgressBar, FileUploadDropZone } from '@/components/application/file-upload/file-upload-base';
import { ACCEPTED_EXTENSIONS, MAX_FILE_BYTES, templateCsv } from '../import/columns';
import { parseMaterialFile, type ParseOutcome } from '../import/parseFile';
import { copy } from '../copy';
import type { IncomingMaterial } from '../model/types';

export interface Parsed {
  fileName: string;
  rows: IncomingMaterial[];
}
const mb = (b: number) => Math.round(b / 1024 / 1024);

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([templateCsv()], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'materials-template.csv' });
  a.click();
  URL.revokeObjectURL(url);
}
const TemplateLink = () => (
  <Button color="link-color" size="sm" iconLeading={Download01} onPress={downloadTemplate}>
    {copy.upload.template}
  </Button>
);

interface Props {
  file: File | null;
  outcome: ParseOutcome | null;
  onFile(file: File | null, outcome: ParseOutcome | null): void;
}
/** Drop zone -> file row with read progress and row count, or an error card with a link to the template. State is lifted so Back keeps the file. */
export function UploadStep({ file, outcome, onFile }: Props) {
  const [progress, setProgress] = useState(outcome ? 100 : 0);
  const take = async (f: File) => {
    setProgress(0);
    onFile(f, null);
    onFile(f, await parseMaterialFile(f, setProgress));
  };
  const failed = outcome && !outcome.ok ? outcome : null;
  return (
    <div className="flex flex-col gap-3 pt-2">
      {!file || failed ? (
        <FileUploadDropZone
          accept={ACCEPTED_EXTENSIONS.join(',')}
          maxSize={MAX_FILE_BYTES}
          hint={copy.upload.hint(
            ACCEPTED_EXTENSIONS.map((e) => e.slice(1).toUpperCase()).join(' / '),
            mb(MAX_FILE_BYTES),
          )}
          onDropFiles={(fl) => take(fl[0])}
          onDropUnacceptedFiles={(fl) => onFile(fl[0], { ok: false, ...copy.upload.errors.format })}
        />
      ) : null}
      {failed && (
        <div role="alert" className="flex gap-3 rounded-xl border border-secondary p-4 shadow-xs">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-fg-error-primary" />
          <div>
            <p className="text-sm font-semibold text-secondary">{failed.title}</p>
            <p className="text-sm text-tertiary">{failed.message}</p>
          </div>
        </div>
      )}
      {file && !failed && (
        <ul>
          <FileListItemProgressBar
            name={file.name}
            size={file.size}
            progress={progress}
            type={file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'xls'}
            onDelete={() => onFile(null, null)}
          />
        </ul>
      )}
      {outcome?.ok && <p className="text-sm text-tertiary">{copy.upload.fileInfo(outcome.rows.length)}</p>}
      <div>
        <TemplateLink />
      </div>
    </div>
  );
}
