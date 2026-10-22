import type { AppConfig } from './config';
import { log } from './logger';

/**
 * Product analytics for a testing deployment: page views, clicks and full session recordings (what people do, where they hesitate), through PostHog. It is OFF unless the configuration
 * enables it and gives a project key, and the library is loaded only then (a normal build never downloads it). Passwords are never recorded; everything else a person types is, so
 * use it with test accounts and dummy data. People are identified by username and role only (no name or e-mail leaves the browser).
 */
type PostHog = typeof import('posthog-js').default;
let client: PostHog | null = null;
let pending: Promise<void> | null = null;
let who: { id: string; props: Record<string, unknown> } | null = null;

const apply = () => {
  if (client && who) client.identify(who.id, who.props);
};

/** Start analytics when the configuration asks for it. Never throws: a failure is logged and the app carries on without it. */
export function initAnalytics(config: AppConfig): Promise<void> {
  const { enabled, key, host } = config.analytics;
  if (!enabled || !key) return Promise.resolve();
  pending ??= import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: host,
        person_profiles: 'identified_only',
        capture_pageview: 'history_change', // the app is one page: every route change counts as a page view
        capture_pageleave: true,
        autocapture: true,
        disable_session_recording: false,
        session_recording: { maskAllInputs: false, maskInputOptions: { password: true } },
      });
      posthog.register({ environment: config.environment, release: config.release });
      client = posthog;
      apply();
    })
    .catch((e) =>
      log.child('analytics').warn(`analytics could not start: ${e instanceof Error ? e.message : String(e)}`),
    );
  return pending;
}

/** Tell analytics who is using the app (null = signed out: the next person is a new visitor). */
export function identifyPerson(person: { id: string; role: string; workspace?: string } | null) {
  if (!person) {
    who = null;
    client?.reset();
    return;
  }
  who = { id: person.id, props: { role: person.role } };
  apply();
}

/** A named moment worth counting (a flow finished, a button of interest). No-op when analytics is off. */
export function track(event: string, props?: Record<string, unknown>) {
  client?.capture(event, props);
}

/** For tests: forget everything. */
export function resetAnalyticsForTests() {
  client = null;
  pending = null;
  who = null;
}
