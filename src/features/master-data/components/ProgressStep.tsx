import { ProgressBar } from '@/components/base/progress-indicators/progress-indicators';
import { copy } from '../copy';
import { useImportJob } from '../import/job';

/** Live progress of the running file import (reads the job store, so it stays correct if the dialog is closed and reopened). */
export function ProgressStep() {
  const total = useImportJob((s) => s.total);
  const done = useImportJob((s) => s.done);
  return (
    <div className="flex flex-col gap-2 pt-2 pb-2">
      <ProgressBar
        value={total ? (done / total) * 100 : 0}
        labelPosition="right"
        valueFormatter={(v) => `${Math.round(v)}%`}
      />
      <p className="text-sm text-tertiary">{copy.progress.count(done, total)}</p>
    </div>
  );
}
