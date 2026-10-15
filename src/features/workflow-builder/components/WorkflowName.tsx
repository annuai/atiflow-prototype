import { InlineNameEdit } from '@/components/form/InlineNameEdit';
import { workflowNameError } from '../model/names';
import { wfStore } from '../model/store';
import { copy } from '../copy';

/** Workflow name in the canvas header with an edit button (shared inline editor). Names are edited by hand only. */
export function WorkflowName({ name }: { name: string }) {
  const save = (to: string) => {
    const e = workflowNameError(to);
    if (e) return e;
    wfStore.getState().renameWorkflow(to);
    return '';
  };
  return (
    <InlineNameEdit
      value={name}
      label={copy.name.label}
      tooltip={copy.name.tooltip}
      onSave={save}
      display={
        <h2 className="wf-name" title={name}>
          {name}
        </h2>
      }
    />
  );
}
