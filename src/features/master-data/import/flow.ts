export type Method = 'api' | 'file' | 'manual';
export type Step = 'method' | 'api' | 'upload' | 'review' | 'progress' | 'manual';
/** Steps of each add method, in order. The "Step n of m" text counts only `numbered` steps. */
const METHOD_STEPS: Record<Method, Step[]> = {
  api: ['api'],
  file: ['upload', 'review', 'progress'],
  manual: ['manual'],
};
const NUMBERED: Step[] = ['upload', 'review'];

export interface FlowState {
  open: boolean;
  step: Step;
  method: Method | null;
  mode: 'add' | 'addMore';
}
export type FlowAction =
  | { type: 'open'; mode?: 'add' | 'addMore' }
  | { type: 'choose'; method: Method }
  | { type: 'next' }
  | { type: 'toProgress' }
  | { type: 'back' }
  | { type: 'close' };

export const closedFlow: FlowState = { open: false, step: 'method', method: null, mode: 'add' };

/** Pure wizard logic: which dialog is showing and where Back / Continue lead. "Add more from API" skips the method chooser. */
export function flowReducer(s: FlowState, a: FlowAction): FlowState {
  switch (a.type) {
    case 'open':
      return a.mode === 'addMore'
        ? { open: true, step: 'api', method: 'api', mode: 'addMore' }
        : { open: true, step: 'method', method: 'api', mode: 'add' };
    case 'choose':
      return { ...s, method: a.method };
    case 'next': {
      if (s.step === 'method') return s.method ? { ...s, step: METHOD_STEPS[s.method][0] } : s;
      const steps = s.method ? METHOD_STEPS[s.method] : [];
      const i = steps.indexOf(s.step);
      return i >= 0 && i < steps.length - 1 ? { ...s, step: steps[i + 1] } : closedFlow;
    }
    case 'toProgress':
      return { ...s, step: 'progress' };
    case 'back': {
      const steps = s.method ? METHOD_STEPS[s.method] : [];
      const i = steps.indexOf(s.step);
      if (i > 0) return { ...s, step: steps[i - 1] };
      return s.mode === 'addMore' ? closedFlow : { ...s, step: 'method' };
    }
    case 'close':
      return closedFlow;
  }
}

/** { n, total } for the "Step n of m" line of a numbered step, else null. */
export function stepNumber(method: Method | null, step: Step) {
  if (!method) return null;
  const numbered = METHOD_STEPS[method].filter((x) => NUMBERED.includes(x));
  const i = numbered.indexOf(step);
  return i < 0 ? null : { n: i + 1, total: numbered.length };
}
