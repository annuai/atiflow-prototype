/** One row of an external material catalogue (ERP / inventory system). */
export interface ErpRow {
  code: string;
  name: string;
  /** Group code or name exactly as the ERP gives it. */
  group: string;
  /** ERP material type (e.g. ZSFG). Optional: not every source has it. */
  type?: string;
}
export interface ErpQuery {
  text: string;
  prefix: string;
  /** Page size. */
  limit: number;
  /** First row of the page (default 0). */
  offset?: number;
}
export interface ErpResult {
  /** Rows matching the whole query, not only this page. */
  total: number;
  rows: ErpRow[];
}

/** One line of a bill of materials. NOT used by any screen yet: the contract is kept open so a BOM view can be added without changing the port. */
interface ErpBomLine {
  code: string;
  name: string;
  type?: string;
  quantity: number;
  uom: string;
}
interface ErpBom {
  code: string;
  version: number;
  active: boolean;
  quantity: number;
  uom: string;
  process?: string;
  components: ErpBomLine[];
}

/**
 * Where "Import from API" reads from. The UI only knows this interface; the dummy adapter (services/dummy/erp) answers from a worker, a real one calls the ERP.
 * Real contract: GET /materials?q=&prefix=&offset=&limit= -> { total, items }.
 */
export interface MaterialSource {
  /** One page of the matches (stale answers are the caller's to ignore). */
  search(q: ErpQuery): Promise<ErpResult>;
  /** EVERY match of the search and prefix (limit and offset ignored), for "Select all N". */
  all(q: Omit<ErpQuery, 'limit' | 'offset'>): Promise<ErpRow[]>;
  /** The bill of materials of one material. Optional and unused today. */
  bom?(code: string): Promise<ErpBom | null>;
}
