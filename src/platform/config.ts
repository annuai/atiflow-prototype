import { z } from 'zod';

/**
 * Runtime configuration: what changes between environments without a rebuild. Order of precedence, lowest first: the defaults below, build-time `VITE_*` variables, and `/config.json`
 * served next to the app (so the cloud team can set it per environment at deploy time). Everything is validated; a bad value is reported and ignored, never used half-parsed.
 */
const url = z.url().optional();
export const AppConfigSchema = z.object({
  /** Where this build runs; shown in logs and error reports. */
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  /** Version or build id of what is deployed (set by the pipeline). */
  release: z.string().default('dev'),
  /** `dummy` = every service uses its built-in fixtures and the simulator; `api` = the services call the URLs below. */
  dataMode: z.enum(['dummy', 'api']).default('dummy'),
  api: z.object({ fleetManager: url, deploymentManager: url, auth: url }).default({}),
  /** Feature flags by name; a missing flag is off. */
  features: z.record(z.string(), z.boolean()).default({}),
  logLevel: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
  /** Which data profile a fresh browser starts in: `demo` (the starting data) or `blank` (an empty site). A person's own choice (Settings, or `?profile=`) wins. */
  profile: z.enum(['demo', 'blank']).default('demo'),
  errorReporting: z
    .object({ enabled: z.boolean().default(false), dsn: z.string().optional() })
    .default({ enabled: false }),
  /** Product analytics with session recordings (PostHog), for a testing deployment: off unless `enabled` and a project `key` are both set. */
  analytics: z
    .object({
      enabled: z.boolean().default(false),
      key: z.string().optional(),
      host: z.url().default('https://us.i.posthog.com'),
    })
    .default({ enabled: false, host: 'https://us.i.posthog.com' }),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;

export const DEFAULT_CONFIG: AppConfig = AppConfigSchema.parse({});
let current: AppConfig = DEFAULT_CONFIG;

/** The configuration in force. Safe to call at any time (the defaults until `loadConfig` has run). */
export const getConfig = (): AppConfig => current;
export const isFeatureEnabled = (flag: string): boolean => current.features[flag] === true;
/** For tests and tools: set the configuration directly (validated). */
export function setConfig(value: unknown): AppConfig {
  current = AppConfigSchema.parse(value);
  return current;
}

export interface ConfigSources {
  env?: Record<string, unknown>;
  fetchJson?: () => Promise<unknown>;
  onProblem?: (message: string) => void;
}
/** The part of the config that `VITE_*` variables can set. */
export function fromEnv(env: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (env.VITE_ENVIRONMENT) out.environment = env.VITE_ENVIRONMENT;
  if (env.VITE_RELEASE) out.release = env.VITE_RELEASE;
  if (env.VITE_DATA_MODE) out.dataMode = env.VITE_DATA_MODE;
  if (env.VITE_LOG_LEVEL) out.logLevel = env.VITE_LOG_LEVEL;
  if (env.VITE_PROFILE) out.profile = env.VITE_PROFILE;
  const api: Record<string, unknown> = {};
  if (env.VITE_FLEET_MANAGER_URL) api.fleetManager = env.VITE_FLEET_MANAGER_URL;
  if (env.VITE_DEPLOYMENT_MANAGER_URL) api.deploymentManager = env.VITE_DEPLOYMENT_MANAGER_URL;
  if (env.VITE_AUTH_URL) api.auth = env.VITE_AUTH_URL;
  if (Object.keys(api).length) out.api = api;
  const phKey = env.VITE_POSTHOG_PROJECT_TOKEN ?? env.VITE_POSTHOG_KEY; // (PostHog calls it the project token)
  if (phKey)
    out.analytics = {
      enabled: true,
      key: phKey,
      ...(env.VITE_POSTHOG_HOST ? { host: env.VITE_POSTHOG_HOST } : {}),
    };
  return out;
}
/** Merge config layers (later wins; `api`, `features` and `errorReporting` are merged key by key). */
export function mergeConfig(...layers: Record<string, unknown>[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const l of layers)
    for (const [k, v] of Object.entries(l))
      out[k] =
        v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && out[k]
          ? { ...(out[k] as object), ...(v as object) }
          : v;
  return out;
}
/**
 * Load the configuration once at start-up. Never throws: a layer that is missing or invalid is skipped (and reported through `onProblem`), so the app always starts with something valid.
 */
export async function loadConfig({
  env = {},
  fetchJson,
  onProblem = () => {},
}: ConfigSources = {}): Promise<AppConfig> {
  const layers: Record<string, unknown>[] = [fromEnv(env)];
  if (fetchJson) {
    try {
      const j = await fetchJson();
      if (j && typeof j === 'object') layers.push(j as Record<string, unknown>);
    } catch (e) {
      onProblem(`config.json could not be read: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  let merged = mergeConfig(...layers);
  let parsed = AppConfigSchema.safeParse(merged);
  if (!parsed.success) {
    onProblem(
      `Configuration ignored, using defaults: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
    merged = {};
    parsed = AppConfigSchema.safeParse(merged);
  }
  current = parsed.success ? parsed.data : DEFAULT_CONFIG;
  return current;
}
