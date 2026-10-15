import { z } from 'zod';
import { createValidatedDocument, localBackend, type StorageBackend } from '@/data/storage';
import type { Workflows } from '@/features/workflow-builder/model/types';
import { log } from '@/platform';
import type { WorkflowService } from '../ports';
import { createDocumentRepository } from './repository';

export const WORKFLOWS_KEY = 'atiflow.workflows.v7';
const LEGACY: [2 | 3 | 4 | 5 | 6, string][] = [
  [6, 'atiflow.workflows.v6'],
  [5, 'atiflow.workflows.v5'],
  [4, 'atiflow.workflows.v4'],
  [3, 'atiflow.workflows.v3'],
  [2, 'atiflow.workflows.v2'],
];
/** The envelope is checked here; the workflows' own shape is the builder's business (its store upgrades and repairs what it reads). */
const SavedSchema = z.object({
  workflows: z.record(z.string(), z.object({ id: z.string(), nodes: z.array(z.unknown()) }).passthrough()).nullable(),
  current: z.string().nullable().optional(),
});

/** DUMMY workflows: kept in browser storage; `null` until something is saved (the store then starts from the sample workflows). */
export function createDummyWorkflows(backend: (key: string) => StorageBackend = localBackend): WorkflowService {
  const b = backend(WORKFLOWS_KEY);
  const doc = createValidatedDocument({
    backend: b,
    schema: SavedSchema,
    seed: (): z.infer<typeof SavedSchema> => ({ workflows: null }),
    onInvalid: (why) => log.child('workflows').warn(`saved workflows ignored: ${why}`),
  });
  const repo = createDocumentRepository({ key: WORKFLOWS_KEY, backend: b, doc });
  const asWorkflows = (v: z.infer<typeof SavedSchema>) => v.workflows as Workflows | null; // the builder's store checks and repairs the workflows themselves
  return {
    snapshot: () => asWorkflows(repo.snapshot()),
    hydrate: async () => asWorkflows(await repo.hydrate()),
    save: (value) => repo.save({ workflows: value as z.infer<typeof SavedSchema>['workflows'], current: null }),
    subscribe: (listener) => repo.subscribe((v) => listener(asWorkflows(v))),
    resetToSeed: () => asWorkflows(repo.resetToSeed?.() ?? { workflows: null }),
    readLegacy() {
      for (const [version, key] of LEGACY) {
        const raw = backend(key).read();
        if (!raw) continue;
        try {
          return { version, data: JSON.parse(raw) };
        } catch {
          /* unreadable: try an older one */
        }
      }
      return null;
    },
  };
}
