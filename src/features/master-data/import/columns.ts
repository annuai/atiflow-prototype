import type { IncomingMaterial } from '../model/types';

/**
 * Columns a material file may contain. Header matching is case/space/underscore-insensitive and accepts the aliases.
 * The downloadable template and the parser both read this list, so they cannot drift apart.
 */
export interface ImportColumn {
  key: keyof IncomingMaterial;
  header: string;
  aliases: string[];
  required: boolean;
  example: string;
}
export const IMPORT_COLUMNS: ImportColumn[] = [
  {
    key: 'name',
    header: 'Material name',
    aliases: ['name', 'material', 'description'],
    required: true,
    example: 'Steel Bracket 40mm',
  },
  {
    key: 'code',
    header: 'Material code',
    aliases: ['code', 'materialid', 'sku', 'item code'],
    required: true,
    example: 'MAT-1001',
  },
  {
    key: 'groupName',
    header: 'Material group',
    aliases: ['group', 'category'],
    required: false,
    example: 'Fasteners & Fixings',
  },
];
export const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx'];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const canon = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
/** Map each header cell to a column key, or null when it is not recognised. */
export function mapHeaders(headers: unknown[]): (ImportColumn['key'] | null)[] {
  return headers.map(
    (h) => IMPORT_COLUMNS.find((c) => [c.header, ...c.aliases].some((a) => canon(a) === canon(h)))?.key ?? null,
  );
}
export const templateCsv = () =>
  [IMPORT_COLUMNS.map((c) => c.header), IMPORT_COLUMNS.map((c) => c.example)].map((r) => r.join(',')).join('\n') + '\n';
