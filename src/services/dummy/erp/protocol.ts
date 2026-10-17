import type { ErpQuery } from '@/features/master-data/sources/types';

export type WorkerRequest =
  | { id: number; url: string; op: 'search'; q: ErpQuery }
  | { id: number; url: string; op: 'all'; q: Omit<ErpQuery, 'limit' | 'offset'> };
export type WorkerResponse = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string };
