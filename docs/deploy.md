# Deploying the front end

Ati Flow is a static single-page app: `npm run build` produces `dist/`, any static host can serve it. Two things matter: unknown paths must serve `index.html` (the router draws the page), and the environment settings live in `config.json` next to it, so ONE build runs in every environment.

## Container (recommended)
```
docker build -t ati-flow --build-arg RELEASE=$(git rev-parse --short HEAD) .
docker run -p 8080:8080 -e ENVIRONMENT=staging -e DATA_MODE=dummy ati-flow
```
Files: `Dockerfile` (build, then nginx), `deploy/nginx.conf` (SPA fallback, caching, security headers), `deploy/40-config.sh` (writes `/config.json` from the variables at start-up).

| variable | meaning | default |
|---|---|---|
| `ENVIRONMENT` | `development`, `staging` or `production` (shown in logs and error reports) | `production` |
| `PROFILE` | `demo` (the starting data, today's behaviour) or `blank` (an empty site: no fleets, robots, maps, materials or workflows, and no built-in demo floor). A person's own choice in Settings (or `?profile=`) wins; the two profiles keep their data apart | `demo` |
| `DATA_MODE` | `dummy` (built-in fixtures and simulator) or `api` (the services call the URLs below; a service without an HTTP adapter yet falls back to dummy and logs a warning) | `dummy` |
| `POSTHOG_KEY`, `POSTHOG_HOST` | turns on product analytics with full session recordings (PostHog) for a TESTING deployment: page views, clicks and everything typed except passwords, per person (username and role). Leave unset for a normal deployment: nothing is loaded or sent. Host defaults to `https://us.i.posthog.com` (use the EU one for an EU project). Build-time equivalents (use these on Vercel, then redeploy because they are read at build): `VITE_POSTHOG_PROJECT_TOKEN` (or `VITE_POSTHOG_KEY`), `VITE_POSTHOG_HOST` | off |
| `API_FLEET_MANAGER_URL`, `API_DEPLOYMENT_MANAGER_URL`, `API_AUTH_URL` | addresses of the real systems (only with `DATA_MODE=api`) | none |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error`, `silent` | `warn` |
| `RELEASE` | version or build id (also a build argument) | `unknown` |

## Other hosts
- **Vercel / Netlify / similar:** `vercel.json` already rewrites everything to `index.html`; set the same settings by editing `config.json` in the deployed files or with `VITE_*` build variables (`VITE_ENVIRONMENT`, `VITE_DATA_MODE`, `VITE_LOG_LEVEL`, `VITE_FLEET_MANAGER_URL`, `VITE_DEPLOYMENT_MANAGER_URL`, `VITE_AUTH_URL`, `VITE_RELEASE`).
- **Object storage + CDN:** upload `dist/`, make `index.html` the error document for 404s, cache `assets/*` for a year, never cache `index.html` or `config.json`.

## Security headers
`deploy/nginx.conf` sends `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` and `Permissions-Policy`. The **Content-Security-Policy is report-only on purpose**: it was written from what the app loads (own scripts and styles, Google Fonts, `blob:` workers, `https:` connections) but NOT yet verified in a running container (no Docker was available when it was written). Deploy to staging, open every page, fix what the browser reports in the console, tighten `connect-src` to the real API hosts, then rename the header to `Content-Security-Policy`.

## Before a real launch
Turn `DATA_MODE` to `api` only when the adapters exist (CLAUDE.md section 59, audit-2 item 1 and 4). Sign-in is a dummy (plain-text seed passwords, a username in browser storage): replace the `auth` and `session` services with the identity provider first. The dev handles `window.__*` exist only in development builds.
