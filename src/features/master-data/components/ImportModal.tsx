import { useEffect, useMemo, useReducer, useState } from 'react';
import { PackagePlus } from '@untitledui/icons';
import { DialogLayout, ModalFrame } from '@/components/modal/ModalShell';
import { notify } from '@/ui/toast';
import { copy } from '../copy';
import { closedFlow, flowReducer, stepNumber, type FlowState } from '../import/flow';
import { cancelImport, resetImport, startImport, useImportJob } from '../import/job';
import { classifyRows } from '../import/review';
import type { ParseOutcome } from '../import/parseFile';
import { materialFields } from '../model/fields';
import { validateMaterial } from '../model/logic';
import { masterDataStore, useMasterData } from '../model/store';
import { services } from '@/services';
import type { ErpRow, MaterialSource } from '../sources/types';
import { ApiStep } from './ApiStep';
import { FieldStack } from './MaterialForm';
import { MethodStep } from './MethodStep';
import { ProgressStep } from './ProgressStep';
import { ReviewStep } from './ReviewStep';
import { UploadStep } from './UploadStep';
import { focusFirstError } from '@/utils/focus-first-error';

const BIG_IMPORT = 500;

/** Controller for the add-materials flow: the state machine (`flowReducer`) decides the step, this renders it. */
export function useImportFlow() {
  const [flow, dispatch] = useReducer(flowReducer, closedFlow);
  return { flow, open: (mode?: FlowState['mode']) => dispatch({ type: 'open', mode }), dispatch };
}

interface Props {
  flow: FlowState;
  dispatch(a: Parameters<typeof flowReducer>[1]): void;
  source?: MaterialSource;
}

export function ImportModal({ flow, dispatch, source }: Props) {
  const erp = source ?? services().materialCatalog;
  const materials = useMasterData((s) => s.materials);
  const job = useImportJob((s) => s);
  // state that must survive Back / Continue
  const [picked, setPicked] = useState<{ codes: Set<string>; rows: Map<string, ErpRow> }>({
    codes: new Set(),
    rows: new Map(),
  });
  const [file, setFile] = useState<File | null>(null);
  const [outcome, setOutcome] = useState<ParseOutcome | null>(null);
  const [reviewSel, setReviewSel] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState({ name: '', code: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // a fresh opening starts clean (everything is cleared when the dialog closes)
  const [wasOpen, setWasOpen] = useState(flow.open);
  if (wasOpen !== flow.open) {
    setWasOpen(flow.open);
    if (!flow.open) {
      setPicked({ codes: new Set(), rows: new Map() });
      setFile(null);
      setOutcome(null);
      setReviewSel(new Set());
      setManual({ name: '', code: '' });
      setErrors({});
    }
  }
  // leaving the progress step when the job ends
  useEffect(() => {
    if (flow.open && flow.step === 'progress' && (job.status === 'done' || job.status === 'cancelled')) {
      dispatch({ type: 'close' });
      resetImport();
    }
  }, [flow.open, flow.step, job.status, dispatch]);

  const rows = useMemo(() => (outcome?.ok ? outcome.rows : []), [outcome]);
  const review = useMemo(
    () =>
      rows.length === 0
        ? [] // (only the file flow classifies; with tens of thousands of materials this is not free)
        : classifyRows(
            rows,
            materials.map((m) => m.code),
          ),
    [rows, materials],
  );
  const close = () => dispatch({ type: 'close' });
  const fields = materialFields([]);
  const numbered = stepNumber(flow.method, flow.step);
  const stepText = (what: string) => (numbered ? copy.upload.stepOf(numbered.n, numbered.total, what) : what);

  const goReview = () => {
    setReviewSel(new Set(review.filter((r) => r.status === 'available').map((r) => r.code)));
    dispatch({ type: 'next' });
  };
  const importFile = () => {
    startImport(
      review.filter((r) => reviewSel.has(r.code)).map(({ status: _s, ...r }) => r),
      file?.name ?? '',
    );
    dispatch({ type: 'next' });
  };
  const submitApi = () => {
    const incoming = [...picked.codes]
      .map((c) => picked.rows.get(c))
      .filter((r): r is ErpRow => !!r)
      .map((r) => ({ code: r.code, name: r.name, groupName: r.group }));
    if (incoming.length > BIG_IMPORT) {
      // a big list goes through the background job: progress, cancel and "run in background"
      startImport(incoming, copy.api.sourceName);
      dispatch({ type: 'toProgress' });
      return;
    }
    const n = masterDataStore.getState().addMaterials(incoming);
    close();
    const d = copy.api.done(n);
    notify.success(d.title, d.body, 'materials-added');
  };
  const submitManual = () => {
    const e = validateMaterial(manual, materials);
    setErrors(e);
    if (Object.keys(e).length) return focusFirstError();
    masterDataStore.getState().addMaterials([{ code: manual.code, name: manual.name }]);
    close();
    notify.success(copy.manual.done.title, copy.manual.done.body, 'materials-added');
  };

  const common = { icon: PackagePlus } as const;
  let body;
  switch (flow.step) {
    case 'method':
      body = (
        <DialogLayout
          {...common}
          title={copy.method.title}
          subtitle={copy.method.subtitle}
          secondary={{ label: copy.method.cancel, onPress: close }}
          primary={{ label: copy.method.next, onPress: () => dispatch({ type: 'next' }) }}
        >
          <MethodStep method={flow.method} onChange={(method) => dispatch({ type: 'choose', method })} />
        </DialogLayout>
      );
      break;
    case 'api': {
      const more = flow.mode === 'addMore';
      const n = picked.codes.size;
      body = (
        <DialogLayout
          {...common}
          title={more ? copy.api.addMoreTitle : copy.api.title}
          subtitle={more ? copy.api.addMoreSubtitle : copy.api.subtitle}
          secondary={{ label: copy.api.cancel, onPress: close }}
          primary={{ label: more ? copy.api.add(n) : copy.api.create(n), isDisabled: n === 0, onPress: submitApi }}
        >
          <ApiStep
            source={erp}
            showStatus={more || materials.length > 0}
            selected={picked.codes}
            picked={picked.rows}
            onSelect={(codes, rows) => setPicked({ codes, rows })}
          />
        </DialogLayout>
      );
      break;
    }
    case 'upload':
      body = (
        <DialogLayout
          {...common}
          title={copy.upload.title}
          subtitle={stepText(copy.upload.uploadStep)}
          secondary={{ label: copy.upload.back, onPress: () => dispatch({ type: 'back' }) }}
          primary={{ label: copy.upload.next, isDisabled: !outcome?.ok, onPress: goReview }}
        >
          <UploadStep
            file={file}
            outcome={outcome}
            onFile={(f, o) => {
              setFile(f);
              setOutcome(o);
            }}
          />
        </DialogLayout>
      );
      break;
    case 'review':
      body = (
        <DialogLayout
          {...common}
          title={copy.review.title}
          subtitle={`${stepText(copy.review.rowsFound(rows.length, file?.name ?? ''))}`}
          secondary={{ label: copy.review.back, onPress: () => dispatch({ type: 'back' }) }}
          primary={{ label: copy.review.import(reviewSel.size), isDisabled: reviewSel.size === 0, onPress: importFile }}
        >
          <ReviewStep rows={rows} selected={reviewSel} onSelect={setReviewSel} />
        </DialogLayout>
      );
      break;
    case 'progress':
      body = (
        <DialogLayout
          {...common}
          title={copy.progress.title}
          subtitle={copy.progress.body(job.total, job.fileName)}
          secondary={{ label: copy.progress.cancel, onPress: cancelImport }}
          primary={{ label: copy.progress.background, onPress: close }}
        >
          <ProgressStep />
        </DialogLayout>
      );
      break;
    case 'manual':
      body = (
        <DialogLayout
          {...common}
          title={copy.manual.title}
          subtitle={copy.manual.subtitle}
          secondary={{ label: copy.manual.cancel, onPress: () => dispatch({ type: 'back' }) }}
          primary={{ label: copy.manual.submit }}
          onSubmit={submitManual}
        >
          <FieldStack
            fields={[fields.name, fields.code]}
            values={manual}
            errors={errors}
            onChange={(k, v) => {
              setManual((m) => ({ ...m, [k]: v }));
              setErrors((e) => ({ ...e, [k]: '' }));
            }}
          />
        </DialogLayout>
      );
      break;
  }
  return (
    <ModalFrame
      isOpen={flow.open}
      onOpenChange={(o) => !o && close()}
      size={flow.step === 'review' ? 'lg' : 'md'}
      label={copy.method.title}
    >
      {body}
    </ModalFrame>
  );
}
