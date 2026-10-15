import { log } from './logger';

export interface ErrorContext {
  where?: string;
  user?: string;
  extra?: Record<string, unknown>;
}
/** Receives every error the app wants to know about. The default only logs; a monitoring service (Sentry...) is another implementation registered at start-up. */
export interface ErrorReporter {
  capture(error: unknown, context?: ErrorContext): void;
}

export const loggingReporter: ErrorReporter = {
  capture(error, context) {
    log.child('errors').error(error instanceof Error ? error.message : String(error), { error, ...context });
  },
};
let reporter: ErrorReporter = loggingReporter;
export function setErrorReporter(next: ErrorReporter) {
  reporter = next;
}
/** Report an error (never throws, even if the reporter does). */
export function reportError(error: unknown, context?: ErrorContext) {
  try {
    reporter.capture(error, context);
  } catch (e) {
    log.child('errors').error('the error reporter failed', e);
  }
}

/** Report errors nobody caught (window errors and rejected promises). Returns a function that removes the handlers. */
export function installGlobalErrorHandlers(
  target: Pick<Window, 'addEventListener' | 'removeEventListener'>,
): () => void {
  const onError = (e: ErrorEvent) => reportError(e.error ?? e.message, { where: 'window.onerror' });
  const onRejection = (e: PromiseRejectionEvent) => reportError(e.reason, { where: 'unhandledrejection' });
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
