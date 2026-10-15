import { getConfig } from './config';

/** Facts attached to every log line, error report and metric: which release, which environment, who is signed in. The app registers the part only it knows (the signed-in user). */
export interface RuntimeContext {
  release: string;
  environment: string;
  user?: string;
}
let extra: () => Partial<RuntimeContext> = () => ({});
/** Register where the app's own facts (the signed-in user) come from. Call once, at start-up. */
export function setRuntimeContext(provider: () => Partial<RuntimeContext>) {
  extra = provider;
}
export function runtimeContext(): RuntimeContext {
  const { release, environment } = getConfig();
  return { release, environment, ...extra() };
}
