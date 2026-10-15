/** One row of an external material catalogue (ERP / inventory system). */
export interface ErpRow {
  code: string;
  name: string;
  group: string;
}
export interface ErpQuery {
  text: string;
  prefix: string;
  limit: number;
}
export interface ErpResult {
  total: number;
  rows: ErpRow[];
}

/** Where "Import from API" reads from. Swap the implementation to talk to a real ERP; the UI only knows this interface. */
export interface MaterialSource {
  search(q: ErpQuery): Promise<ErpResult>;
}
