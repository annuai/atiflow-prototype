export type FieldValue = string | string[];

/** One form field, declared once and rendered by FormField everywhere (Add dialogs, detail pages, edit dialogs). */
export interface FieldDef {
  key: string;
  label: string;
  control: 'text' | 'secret' | 'select' | 'checks' | 'fleet';
  options?: string[];
  placeholder?: string;
  required?: boolean;
  unique?: boolean;
  /** Small badge beside the label, e.g. "Ati Exclusive". */
  tag?: string;
  /** Add modal: omitted = not asked, 'half' = two per row. */
  modal?: 'full' | 'half';
  /** Detail page: omitted = not shown. */
  detail?: boolean | { label?: string; display?: 'text' | 'badge' | 'badges'; editable?: boolean };
  /** Position in the detail grid (lower first); fields without one keep declaration order after the ordered ones. */
  detailOrder?: number;
  /** Value used when the modal does not ask for it (new records). */
  initial?: FieldValue;
}
