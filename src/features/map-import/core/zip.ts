import { unzipSync } from 'fflate';
import { ImportError, type Entries } from './types';

/** Limits against a zip that expands into something huge (zip bombs) or holds absurdly many files. */
export const ZIP_LIMITS = { entries: 200, entryBytes: 100 * 1024 * 1024, totalBytes: 300 * 1024 * 1024 };

const junk = (path: string) =>
  path.endsWith('/') || path.split('/').some((p) => p === '__MACOSX' || p.startsWith('.') || p === 'Thumbs.db');

/** Unzip in memory. Junk is skipped before it is inflated; the limits throw an `ImportError`. Paths are only ever used as lookup keys (nothing is written to disk). */
export function readZip(bytes: Uint8Array, limits = ZIP_LIMITS): Entries {
  let count = 0,
    total = 0;
  try {
    return unzipSync(bytes, {
      filter(f) {
        if (junk(f.name)) return false;
        if (++count > limits.entries) throw new ImportError('zip.tooMany', 'The zip holds too many files');
        if (f.originalSize > limits.entryBytes) throw new ImportError('zip.tooBig', `${f.name} is too large`);
        total += f.originalSize;
        if (total > limits.totalBytes) throw new ImportError('zip.tooBig', 'The zip is too large when opened');
        return true;
      },
    });
  } catch (e) {
    if (e instanceof ImportError) throw e;
    throw new ImportError('zip.invalid', 'This is not a readable zip file');
  }
}

/** The file called `name` wherever it sits in the zip (the files may be inside a folder, or two folders deep). */
export function findEntry(entries: Entries, name: string): Uint8Array | undefined {
  const k = Object.keys(entries).find((p) => p === name || p.endsWith('/' + name));
  return k ? entries[k] : undefined;
}
export const entryPath = (entries: Entries, name: string) =>
  Object.keys(entries).find((p) => p === name || p.endsWith('/' + name));
