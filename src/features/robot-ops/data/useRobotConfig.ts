import { useMemo, useState } from 'react';
import { services } from '@/services';
import { notify } from '@/ui/toast';
import { useResource } from '@/hooks/use-resource';
import { configErrors, changedKeys, normaliseDraft } from '../model/config';
import type { ConfigSchema, ConfigValue, ConfigValues, RobotRef } from '../model/types';
import { copy } from '../copy';

/** The configuration of one robot as a screen needs it: what is saved, an edit in progress (draft), checks and the two actions. Talks to `services().robotOps` only. */
export function useRobotConfig(robot: RobotRef) {
  const ops = services().robotOps;
  const schema = useResource<ConfigSchema>(() => ops.config.schema(robot), `schema:${robot.type}`);
  const values = useResource<ConfigValues>(() => ops.config.get(robot), `values:${robot.name}`);
  const [draft, setDraft] = useState<ConfigValues | null>(null);
  const [busy, setBusy] = useState(false);
  const editing = draft !== null;
  const errors = useMemo(
    () => (schema.data && draft ? configErrors(schema.data, draft) : ({} as Record<string, string>)),
    [schema.data, draft],
  );
  const dirty = !!values.data && !!draft && changedKeys(values.data, draft).length > 0;
  return {
    schema: schema.data,
    /** what is saved */ values: values.data,
    /** what is shown: the draft while editing */ shown: draft ?? values.data,
    loading: schema.loading || values.loading,
    error: schema.error || values.error,
    reload: () => {
      schema.reload();
      values.reload();
    },
    editing,
    errors,
    dirty,
    busy,
    start: () => values.data && setDraft({ ...values.data }),
    cancel: () => setDraft(null),
    setValue: (key: string, v: ConfigValue) => setDraft((d) => (d ? { ...d, [key]: v } : d)),
    async save(): Promise<boolean> {
      if (!schema.data || !draft) return false;
      if (Object.keys(errors).length) {
        notify.warning(copy.config.fixErrors, undefined, 'robot-config-errors');
        return false;
      }
      setBusy(true);
      try {
        values.set(await ops.config.save(robot, normaliseDraft(schema.data, draft)));
        setDraft(null);
        notify.success(copy.config.saved, undefined, 'robot-config-saved');
        return true;
      } catch (e) {
        notify.error(copy.config.saveFailed, e instanceof Error ? e.message : undefined, 'robot-config-saved');
        return false;
      } finally {
        setBusy(false);
      }
    },
    async restoreDefaults(): Promise<void> {
      setBusy(true);
      try {
        values.set(await ops.config.restoreDefaults(robot));
        setDraft(null);
        notify.success(copy.config.restored, undefined, 'robot-config-saved');
      } catch (e) {
        notify.error(copy.config.saveFailed, e instanceof Error ? e.message : undefined, 'robot-config-saved');
      } finally {
        setBusy(false);
      }
    },
  };
}
export type RobotConfigSession = ReturnType<typeof useRobotConfig>;
