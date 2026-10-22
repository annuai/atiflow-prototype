#!/bin/sh
# Runs when the container starts (nginx image hook): writes /config.json from environment variables, so the SAME image runs in every environment.
# Unset variables fall back to the defaults of the app (see src/platform/config.ts). API_* addresses are only needed when DATA_MODE=api.
set -eu
json_string() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
opt() { [ -n "${2:-}" ] && printf '"%s": "%s"' "$1" "$(json_string "$2")" || true; }
api=""
for pair in "fleetManager:${API_FLEET_MANAGER_URL:-}" "deploymentManager:${API_DEPLOYMENT_MANAGER_URL:-}" "auth:${API_AUTH_URL:-}"; do
  key=${pair%%:*}; val=${pair#*:}
  [ -n "$val" ] && api="${api:+$api, }$(opt "$key" "$val")"
done
# analytics (PostHog session recordings) are off unless POSTHOG_KEY is set
analytics=""
[ -n "${POSTHOG_KEY:-}" ] && analytics="\"enabled\": true, \"key\": \"$(json_string "$POSTHOG_KEY")\"${POSTHOG_HOST:+, \"host\": \"$(json_string "$POSTHOG_HOST")\"}"
cat > /usr/share/nginx/html/config.json <<JSON
{
  "environment": "$(json_string "${ENVIRONMENT:-production}")",
  "release": "$(json_string "${RELEASE:-unknown}")",
  "dataMode": "$(json_string "${DATA_MODE:-dummy}")",
  "logLevel": "$(json_string "${LOG_LEVEL:-warn}")",
  "api": { ${api} },
  "features": {},
  "analytics": { ${analytics} }
}
JSON
echo "config.json written for environment ${ENVIRONMENT:-production} (data mode ${DATA_MODE:-dummy})"
