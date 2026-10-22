import { parseAi } from './ai';
import { buildDrawing } from './build';
import { parseDxf } from './dxf';
import { layerRows, summarise } from './stats';
import { DrawingError, type Built, type Drawing, type RowStats, type Rules, type Summary } from './types';

/** DXF text from bytes: UTF-8 when the file is, else Windows-1252 (old drawings from AutoCAD before 2007). */
function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

export const MAX_BYTES = 450 * 1024 * 1024; // a string of more than about 500 million characters cannot exist in the browser

/** What kind of file this is, from its name and its first bytes. */
export function sniff(name: string, bytes: Uint8Array): 'dxf' | 'ai' | 'dwg' | 'unknown' {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 64));
  if (/^AC10\d\d/.test(head)) return 'dwg';
  if (head.includes('%PDF') || /\.ai$/i.test(name))
    return /%PDF|%!PS/.test(new TextDecoder('latin1').decode(bytes.subarray(0, 1024))) ? 'ai' : 'unknown';
  if (/\.dxf$/i.test(name) || /^\s*0\s+SECTION/.test(head) || head.startsWith('AutoCAD Binary DXF')) return 'dxf';
  if (/\.dwg$/i.test(name)) return 'dwg';
  return 'unknown';
}

/**
 * One opened drawing and what can be asked of it. It runs in a worker (`worker/`) so a big file never freezes the page, and the same class runs on the page's thread where there is no worker (tests).
 */
export class DrawingEngine {
  private drawing: Drawing | null = null;
  open(name: string, bytes: Uint8Array): Summary {
    if (bytes.length > MAX_BYTES)
      throw new DrawingError(
        'too-big',
        'This file is too big to open here. Cut it down to the area of the map with the converter (see the import help).',
      );
    const kind = sniff(name, bytes);
    if (kind === 'dwg')
      throw new DrawingError(
        'dwg',
        'DWG files are converted to DXF first: run the converter (npm run convert:drawing) and open the DXF it writes.',
      );
    if (kind === 'unknown')
      throw new DrawingError('unsupported', 'Open a DXF, an Illustrator (.ai) or a converted DWG file.');
    this.drawing = kind === 'ai' ? parseAi(bytes, name) : parseDxf(decodeText(bytes), name);
    return summarise(this.drawing);
  }
  private get d(): Drawing {
    if (!this.drawing) throw new DrawingError('broken', 'No drawing is open.');
    return this.drawing;
  }
  rows(blockRules: Rules['blocks'], unit: number): RowStats[] {
    return layerRows(this.d, blockRules, unit);
  }
  build(rules: Rules, unit: number): Built {
    return buildDrawing(this.d, rules, unit);
  }
}
