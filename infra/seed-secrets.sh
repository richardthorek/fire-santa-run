#!/usr/bin/env bash
# Fire Santa Run — Container App secret/config seeder
#
# Seeds the Container App's environment variables for an environment from two
# sources:
#   1. Live Azure resources  — the Storage connection string is read back from
#      the deployed Storage account (no deployment output needed), so this
#      script is fully re-runnable independent of a fresh `deploy.sh` run.
#   2. A local secrets file   — SUITE_AUTH_URL, VAPID keys, the realtime WS
#      signing secret, and (optional) ops-alert email settings come from
#      infra/.env.<env> (gitignored) or, failing that, the current shell env.
#
# It is idempotent: `az containerapp update --set-env-vars` replaces only the
# keys given; every other env var already on the revision is left untouched.
#
# Usage:
#   ./infra/seed-secrets.sh                       # seed dev (suffix from dev.bicepparam)
#   ./infra/seed-secrets.sh --env prod            # seed prod
#   ./infra/seed-secrets.sh --env dev --suffix rjt2025
#   ./infra/seed-secrets.sh --dry-run             # show what would be set (values masked)
#   ./infra/seed-secrets.sh --help
#
# Secrets file (infra/.env.<env>) — copy infra/.env.example and fill in:
#   SUITE_AUTH_URL=https://stationkit.com.au
#   VAPID_PUBLIC_KEY=... / VAPID_PRIVATE_KEY=... / VAPID_SUBJECT=mailto:...
#   REALTIME_WS_SECRET=...              # optional — see docs/ARCHITECTURE.md
#   APP_ORIGIN=https://...              # optional public origin override

set -euo pipefail

# ─── Defaults ────────────────────────────────────────────────────────────────

ENVIRONMENT="dev"
NAME_SUFFIX=""
DRY_RUN=false

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Argument Parsing ────────────────────────────────────────────────────────

print_help() {
  cat <<HELP
Fire Santa Run — Container App Secret Seeder

Usage: ./infra/seed-secrets.sh [OPTIONS]

Options:
  --env,    -e  <dev|prod>   Environment to seed (default: dev)
  --suffix, -s  <string>     Resource name suffix (default: read from parameters/<env>.bicepparam)
  --dry-run                  Show which settings would be applied (values masked)
  --help,   -h               Show this help message

Reads SUITE_AUTH_URL/VAPID secrets from infra/.env.<env> (gitignored) or the
shell env, and pulls the Storage connection string live from the deployed
Storage account. Safe to re-run; existing untouched env vars are preserved.
HELP
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --env|-e)    ENVIRONMENT="$2"; shift 2 ;;
    --suffix|-s) NAME_SUFFIX="$2"; shift 2 ;;
    --dry-run)   DRY_RUN=true; shift ;;
    --help|-h)   print_help; exit 0 ;;
    *) echo "❌ Unknown option: $1"; print_help; exit 1 ;;
  esac
done

# ─── Validation ──────────────────────────────────────────────────────────────

if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "prod" ]]; then
  echo "❌ Invalid environment '$ENVIRONMENT'. Must be 'dev' or 'prod'."
  exit 1
fi

PARAMS_FILE="${SCRIPT_DIR}/parameters/${ENVIRONMENT}.bicepparam"

# Resolve the name suffix: explicit --suffix wins, else parse it from the
# environment's bicepparam file so naming stays in lock-step with the IaC.
if [[ -z "$NAME_SUFFIX" ]]; then
  if [[ -f "$PARAMS_FILE" ]]; then
    NAME_SUFFIX=$(grep -E "^\s*param\s+nameSuffix\s*=" "$PARAMS_FILE" \
      | sed -E "s/.*=\s*'([^']+)'.*/\1/" | head -n1)
  fi
fi

if [[ -z "$NAME_SUFFIX" ]]; then
  echo "❌ Could not determine name suffix. Pass --suffix or set it in $PARAMS_FILE."
  exit 1
fi

if ! [[ "$NAME_SUFFIX" =~ ^[a-z0-9]{3,8}$ ]]; then
  echo "❌ Name suffix must be 3–8 lowercase alphanumeric characters (got: '$NAME_SUFFIX')."
  exit 1
fi

# ─── Resource names (must mirror infra/main.bicep + modules) ─────────────────

RESOURCE_GROUP="rg-santarun-${ENVIRONMENT}-${NAME_SUFFIX}"
APP_NAME="santarun-app-${NAME_SUFFIX}"
STORAGE_ACCOUNT="santarun${NAME_SUFFIX}"

# ─── Load local secrets file (gitignored) ────────────────────────────────────
# Shell env takes precedence over the file, so CI can inject secrets without a
# file present. We load the file first, then let any pre-set shell vars win.

ENV_FILE="${SCRIPT_DIR}/.env.${ENVIRONMENT}"
declare -A FILE_VARS=()
if [[ -f "$ENV_FILE" ]]; then
  echo "📄 Loading secrets from ${ENV_FILE#"${SCRIPT_DIR}/../"}"
  while IFS='=' read -r key value; do
    # Skip blanks and comments
    [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
    key="$(echo "$key" | xargs)"                 # trim whitespace
    value="${value%$'\r'}"                        # strip trailing CR
    value="${value#\"}"; value="${value%\"}"      # strip optional wrapping quotes
    value="${value#\'}"; value="${value%\'}"
    [[ -n "$key" ]] && FILE_VARS["$key"]="$value"
  done < "$ENV_FILE"
fi

# resolve VAR: shell env if set, else value from the secrets file, else empty
resolve() {
  local name="$1"
  if [[ -n "${!name:-}" ]]; then
    printf '%s' "${!name}"
  else
    printf '%s' "${FILE_VARS[$name]:-}"
  fi
}

# ─── Pre-flight ──────────────────────────────────────────────────────────────

echo "======================================"
echo "  Fire Santa Run — Seed Container App"
echo "======================================"
echo ""
echo "  Environment    : $ENVIRONMENT"
echo "  Name Suffix    : $NAME_SUFFIX"
echo "  Resource Group : $RESOURCE_GROUP"
echo "  Container App  : $APP_NAME"
echo ""

if ! command -v az &>/dev/null; then
  echo "❌ Azure CLI is not installed."
  echo "   Install it from: https://learn.microsoft.com/cli/azure/install-azure-cli"
  exit 1
fi

if ! az account show &>/dev/null; then
  echo "🔐 Not logged in. Running 'az login'..."
  az login
fi

if ! az extension show --name containerapp &>/dev/null; then
  echo "📦 Installing the 'containerapp' Azure CLI extension..."
  az extension add --name containerapp --only-show-errors 1>/dev/null 2>&1 || \
    echo "⚠️  Could not install the containerapp extension automatically."
fi

# ─── Read live connection strings from the deployed resources ────────────────

echo "🔎 Reading the Storage connection string from the deployed resource..."

STORAGE_CONN=$(az storage account show-connection-string \
  --name "$STORAGE_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --query connectionString --output tsv 2>/dev/null || true)

if [[ -z "$STORAGE_CONN" ]]; then
  echo "❌ Could not read the Storage connection string for '$STORAGE_ACCOUNT'."
  echo "   Confirm the resource group '$RESOURCE_GROUP' and that the deploy has run."
  exit 1
fi
echo "✅ Storage connection string retrieved."

# ─── Public origin ───────────────────────────────────────────────────────────
# Per-environment default; override via APP_ORIGIN (shell env or secrets file).
# The Container App's auto-generated FQDN is only known after deploy — read it
# live rather than guessing the hostname pattern.

if [[ "$ENVIRONMENT" == "prod" ]]; then
  DEFAULT_ORIGIN="https://firesantarun.com.au"
  # CORS accepts both the current domain and the incoming stationkit.com.au
  # subdomain during the suite rebrand transition — narrow this back to a
  # single origin once DNS for santa.stationkit.com.au is live and traffic
  # has cut over.
  DEFAULT_CORS_ORIGIN="https://firesantarun.com.au,https://santa.stationkit.com.au"
else
  CONTAINER_FQDN=$(az containerapp show \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query properties.configuration.ingress.fqdn --output tsv 2>/dev/null || true)
  DEFAULT_ORIGIN="${CONTAINER_FQDN:+https://$CONTAINER_FQDN}"
  DEFAULT_CORS_ORIGIN="$DEFAULT_ORIGIN"
fi
APP_ORIGIN="$(resolve APP_ORIGIN)"
APP_ORIGIN="${APP_ORIGIN:-$DEFAULT_ORIGIN}"
CORS_ORIGIN_VALUE="$(resolve CORS_ORIGIN)"
CORS_ORIGIN_VALUE="${CORS_ORIGIN_VALUE:-$DEFAULT_CORS_ORIGIN}"

if [[ -z "$APP_ORIGIN" ]]; then
  echo "❌ Could not determine the app origin. Pass APP_ORIGIN=https://... or confirm the app deployed."
  exit 1
fi

# ─── Assemble settings ───────────────────────────────────────────────────────
# Base settings are always set. Secret settings are only included when a value
# is available (file or shell), so a partial seed never touches an existing key.

SETTINGS=(
  "AZURE_STORAGE_CONNECTION_STRING=$STORAGE_CONN"
  "DEV_MODE=false"
  "NODE_ENV=production"
  "PORT=8080"
  "CORS_ORIGIN=$CORS_ORIGIN_VALUE"
  "APP_BASE_URL=$APP_ORIGIN"
)

# Optional secrets — SUITE_AUTH_URL points at the Station Manager deployment.
# VAPID_* enables the "notify me when Santa starts" web push (see README).
# REALTIME_WS_SECRET signs the short-lived tokens broadcaster/editor
# WebSocket connections present — optional (falls back to a hash of the
# storage connection string) but worth setting explicitly in prod.
# AZURE_COMMUNICATION_CONNECTION_STRING / EMAIL_FROM_ADDRESS / OPS_ALERT_EMAIL
# enable operational alert emails (server/src/utils/opsAlert.ts) — the first
# two come from `az deployment sub create`'s emailAlertsConnectionString /
# emailAlertsFromAddress outputs once deployed with deployEmailAlerts=true
# (see infra/modules/email-service.bicep); OPS_ALERT_EMAIL is whichever
# mailbox should receive them.
MISSING_SECRETS=()
for name in SUITE_AUTH_URL VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT REALTIME_WS_SECRET \
            AZURE_COMMUNICATION_CONNECTION_STRING EMAIL_FROM_ADDRESS OPS_ALERT_EMAIL; do
  val="$(resolve "$name")"
  if [[ -n "$val" ]]; then
    SETTINGS+=("$name=$val")
  else
    MISSING_SECRETS+=("$name")
  fi
done

# ─── Report / apply ──────────────────────────────────────────────────────────

mask() {
  # Show a key = masked-value summary without leaking secret material.
  local pair="$1" key="${1%%=*}" val="${1#*=}"
  local shown
  if [[ ${#val} -le 8 ]]; then
    shown="****"
  else
    shown="${val:0:4}…${val: -4} (${#val} chars)"
  fi
  printf '    %-34s %s\n' "$key" "$shown"
}

echo ""
echo "Settings to apply (origin: $APP_ORIGIN):"
for pair in "${SETTINGS[@]}"; do mask "$pair"; done

if [[ ${#MISSING_SECRETS[@]} -gt 0 ]]; then
  echo ""
  echo "⚠️  Not provided (left unchanged on the Container App): ${MISSING_SECRETS[*]}"
  echo "    Add them to ${ENV_FILE#"${SCRIPT_DIR}/../"} or export them, then re-run."
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo ""
  echo "🔍 Dry run — no changes applied."
  exit 0
fi

echo ""
echo "Applying to Container App '$APP_NAME'..."
if az containerapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --set-env-vars "${SETTINGS[@]}" \
  --output none; then
  echo "✅ Container App settings seeded ($ENVIRONMENT, origin: $APP_ORIGIN)."
else
  echo "❌ Failed to set env vars. Check permissions and resource names above."
  exit 1
fi
