import { getConfig } from './config';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface LogEntry {
  level: LogLevel;
  scope: string;
  message: string;
  data?: unknown;
  at: number;
}
/** Where log lines go. The default prints to the browser console; a service (Datadog, Cloud Logging...) is another sink. */
export type LogSink = (entry: LogEntry) => void;
export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
  child(scope: string): Logger;
}

const ORDER: Record<LogLevel | 'silent', number> = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };
export const consoleSink: LogSink = ({ level, scope, message, data }) => {
  const line = `[${scope}] ${message}`;
  if (data === undefined) console[level](line);
  else console[level](line, data);
};
let sinks: LogSink[] = [consoleSink];
/** Replace the sinks (start-up, tests). */
export function setLogSinks(next: LogSink[]) {
  sinks = next;
}

export function createLogger(scope = 'app', minLevel: () => LogLevel | 'silent' = () => getConfig().logLevel): Logger {
  const emit = (level: LogLevel) => (message: string, data?: unknown) => {
    if (ORDER[level] >= ORDER[minLevel()]) {
      const entry = { level, scope, message, data, at: Date.now() };
      for (const s of sinks) s(entry);
    }
  };
  return {
    debug: emit('debug'),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
    child: (s) => createLogger(`${scope}:${s}`, minLevel),
  };
}
/** The app's logger. Use `log.child('feature-name')` in a module. */
export const log = createLogger();
