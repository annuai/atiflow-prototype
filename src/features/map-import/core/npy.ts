import { ImportError } from './types';

type NpyData =
  Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array | Float64Array;
export interface NpyArray {
  dtype: string;
  shape: number[];
  data: NpyData;
}

/** Biggest array we will read (cells). The sample map is 16 million; a 16k x 16k grid is 268 million, which no browser should be asked to decode. */
const MAX_NPY_CELLS = 256 * 1024 * 1024;

const MAGIC = [0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59]; // \x93NUMPY

/**
 * Reads a NumPy `.npy` array (format 1.0 to 3.0, little endian, C order, numbers only). Hand written on purpose: the format is a tiny header plus raw bytes, so no library is shipped.
 */
export function readNpy(buf: Uint8Array): NpyArray {
  if (buf.length < 12 || MAGIC.some((b, i) => buf[i] !== b)) throw new ImportError('npy.invalid', 'Not a NumPy array');
  const major = buf[6];
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const hlen = major === 1 ? view.getUint16(8, true) : view.getUint32(8, true);
  const start = (major === 1 ? 10 : 12) + hlen;
  if (major > 3 || start > buf.length) throw new ImportError('npy.invalid', 'Unsupported NumPy format');
  const header = new TextDecoder('latin1').decode(buf.subarray(major === 1 ? 10 : 12, start));
  const descr = /'descr'\s*:\s*'([^']+)'/.exec(header)?.[1];
  const fortran = /'fortran_order'\s*:\s*(True|False)/.exec(header)?.[1];
  const shapeText = /'shape'\s*:\s*\(([^)]*)\)/.exec(header)?.[1];
  if (!descr || !fortran || shapeText === undefined) throw new ImportError('npy.invalid', 'Unreadable NumPy header');
  if (fortran === 'True') throw new ImportError('npy.unsupported', 'Column-major arrays are not supported');
  const shape = shapeText
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
  if (shape.some((n) => !Number.isInteger(n) || n < 0)) throw new ImportError('npy.invalid', 'Unreadable NumPy shape');
  const cells = shape.reduce((a, b) => a * b, 1);
  if (cells > MAX_NPY_CELLS) throw new ImportError('npy.tooBig', 'The array is too large');
  const size: Record<string, number> = {
    '|u1': 1,
    '|i1': 1,
    '<u2': 2,
    '<i2': 2,
    '<u4': 4,
    '<i4': 4,
    '<f4': 4,
    '<i8': 8,
    '<f8': 8,
  };
  const bytes = size[descr];
  if (!bytes) throw new ImportError('npy.unsupported', `Unsupported number type ${descr}`);
  if (start + cells * bytes > buf.length)
    throw new ImportError('npy.invalid', 'The array is shorter than its header says');
  const raw = buf.slice(start, start + cells * bytes).buffer as ArrayBuffer; // a copy: typed arrays need aligned bytes
  const data: NpyData =
    descr === '|u1'
      ? new Uint8Array(raw)
      : descr === '|i1'
        ? new Int8Array(raw)
        : descr === '<u2'
          ? new Uint16Array(raw)
          : descr === '<i2'
            ? new Int16Array(raw)
            : descr === '<u4'
              ? new Uint32Array(raw)
              : descr === '<i4'
                ? new Int32Array(raw)
                : descr === '<f4'
                  ? new Float32Array(raw)
                  : descr === '<f8'
                    ? new Float64Array(raw)
                    : Float64Array.from(new BigInt64Array(raw), Number); // '<i8'
  return { dtype: descr, shape, data };
}
