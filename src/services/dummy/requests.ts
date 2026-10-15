import { createValidatedDocument, localBackend, type StorageBackend } from '@/data/storage';
import { RequestsDocumentSchema, type RequestsDocument } from '@/features/requests/model/schema';
import { log } from '@/platform';
import type { RequestService } from '../ports';
import { createDocumentRepository } from './repository';

export const REQUESTS_KEY = 'atiflow.requests.v1';
/** DUMMY requests: the operators' requests, kept in browser storage. A real deployment keeps them in the fleet manager / request service. */
export function createDummyRequests(backend: (key: string) => StorageBackend = localBackend): RequestService {
  const b = backend(REQUESTS_KEY);
  const doc = createValidatedDocument({
    backend: b,
    schema: RequestsDocumentSchema,
    seed: (): RequestsDocument => ({ requests: [], seq: 0 }),
    onInvalid: (why) => log.child('requests').warn(`saved requests ignored: ${why}`),
  });
  return createDocumentRepository({ key: REQUESTS_KEY, backend: b, doc });
}
