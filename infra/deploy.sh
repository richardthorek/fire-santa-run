#!/usr/bin/env bash
# Fire Santa Run — Azure Infrastructure Deployment Script
#
# Deploys (or re-deploys) all Azure resources using Bicep IaC: Azure Container
# Apps (Consumption, scale-to-zero), Table Storage, and Application Insights.
# There is no separate realtime service to provision — the server fans out
# WebSocket messages in-process (see docs/ARCHITECTURE.md) — so Container Apps
# is the only compute resource.
#
# This script provisions infrastructure and seeds base config; it does not
# build the container image. CI (.github/workflows/deploy-container-apps.yml)
# builds and pushes the image, then runs `az containerapp update --image ...`.
# The first deploy uses a public placeholder image (see main.bicep) so the
# Container App has something to start from before CI has pushed anything;
# pass --image to point at a real one immediately (e.g. after a manual
# `docker build` + `docker push`).
#
# Usage:
#   ./infra/deploy.sh                        # deploy dev environment
#   ./infra/deploy.sh --env prod             # deploy prod environment
#   ./infra/deploy.sh --suffix abc123        # override name suffix
#   ./infra/deploy.sh --env prod --suffix p1 # prod with custom suffix
#   ./infra/deploy.sh --image ghcr.io/you/fire-santa-run:latest --registry-server ghcr.io --registry-username you
#   ./infra/deploy.sh --dry-run              # validate without deploying
#   ./infra/deploy.sh --help                 # show this help

set -euo pipefail

# ─── Defaults ────────────────────────────────────────────────────────────────

ENVIRONMENT="dev"
LOCATION="australiaeast"
NAME_SUFFIX=""
CIAM_DIRECTORY_NAME=""
CONTAINER_IMAGE=""
REGISTRY_SERVER=""
REGISTRY_USERNAME=""
DRY_RUN=false

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Argument Parsing ────────────────────────────────────────────────────────

print_help() {
  cat <<HELP
Fire Santa Run — Azure Deployment Script

Usage: ./infra/deploy.sh [OPTIONS]

Options:
  --env,    -e  <dev|prod>   Environment to deploy (default: dev)
  --suffix, -s  <string>     3–8 char alphanumeric suffix for unique resource names
  --location    <region>     Azure region (default: australiaeast)
  --ciam-directory <name>    Optional existing CIAM directory resource name in target RG
  --image <ref>              Container image to deploy (default: public placeholder;
                              CI updates it after the first push)
  --registry-server <host>   Container registry host (e.g. ghcr.io) — needed if --image is private
  --registry-username <user> Registry username — pass the password via the REGISTRY_PASSWORD env var
  --dry-run                  Validate the template without deploying
  --help,   -h               Show this help message

Examples:
  ./infra/deploy.sh                          # Deploy dev environment
  ./infra/deploy.sh --env prod --suffix p1   # Deploy production
  ./infra/deploy.sh --suffix dev020 --location australiasoutheast
  ./infra/deploy.sh --suffix dev020 --ciam-directory brigadesantarun.onmicrosoft.com
  REGISTRY_PASSWORD=ghp_xxx ./infra/deploy.sh --image ghcr.io/you/fire-santa-run:latest \\
    --registry-server ghcr.io --registry-username you
  ./infra/deploy.sh --dry-run                # Validate dev template only
HELP
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --env|-e)     ENVIRONMENT="$2"; shift 2 ;;
    --suffix|-s)  NAME_SUFFIX="$2"; shift 2 ;;
    --location)   LOCATION="$2"; shift 2 ;;
    --ciam-directory) CIAM_DIRECTORY_NAME="$2"; shift 2 ;;
    --image)      CONTAINER_IMAGE="$2"; shift 2 ;;
    --registry-server)   REGISTRY_SERVER="$2"; shift 2 ;;
    --registry-username) REGISTRY_USERNAME="$2"; shift 2 ;;
    --dry-run)    DRY_RUN=true; shift ;;
    --help|-h)    print_help; exit 0 ;;
    *) echo "❌ Unknown option: $1"; print_help; exit 1 ;;
  esac
done

# ─── Validation ──────────────────────────────────────────────────────────────

if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "prod" ]]; then
  echo "❌ Invalid environment '$ENVIRONMENT'. Must be 'dev' or 'prod'."
  exit 1
fi

PARAMS_FILE="${SCRIPT_DIR}/parameters/${ENVIRONMENT}.bicepparam"

if [[ -n "$NAME_SUFFIX" ]]; then
  if ! [[ "$NAME_SUFFIX" =~ ^[a-z0-9]{3,8}$ ]]; then
    echo "❌ --suffix must be 3–8 lowercase alphanumeric characters (got: '$NAME_SUFFIX')."
    exit 1
  fi
fi

# ─── Pre-flight Checks ───────────────────────────────────────────────────────

echo "======================================"
echo "  Fire Santa Run — Azure Deployment"
echo "======================================"
echo ""
echo "  Environment : $ENVIRONMENT"
echo "  Location    : $LOCATION"
[[ -n "$NAME_SUFFIX" ]] && echo "  Name Suffix : $NAME_SUFFIX"
echo "  Template    : infra/main.bicep"
echo "  Parameters  : ${PARAMS_FILE#"${SCRIPT_DIR}/../"}"
echo ""

if ! command -v az &>/dev/null; then
  echo "❌ Azure CLI is not installed."
  echo "   Install it from: https://docs.microsoft.com/cli/azure/install-azure-cli"
  exit 1
fi

if ! az account show &>/dev/null; then
  echo "🔐 Not logged in. Running 'az login'..."
  az login
fi

SUBSCRIPTION=$(az account show --query name --output tsv)
SUBSCRIPTION_ID=$(az account show --query id --output tsv)
echo "  Subscription: $SUBSCRIPTION ($SUBSCRIPTION_ID)"
echo ""

if [[ "$ENVIRONMENT" == "prod" && "$DRY_RUN" == "false" ]]; then
  read -r -p "⚠️  You are deploying to PRODUCTION. Continue? (y/N) " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
  fi
  echo ""
fi

# ─── Preserve live state across the full-PUT deploy ──────────────────────────
# `az deployment sub create` does a full PUT on the Container App: anything the
# Bicep template doesn't restate is reset. Two things that matter are only known
# at runtime, so read them off the live app and feed them back as parameters:
#   • the running image  — otherwise the PUT reverts it to the placeholder
#   • the custom-domain binding + its certificate — otherwise the hostname is
#     unbound and the origin stops answering TLS for it (Cloudflare 525; this
#     is exactly what took santa.stationkit.com.au down on 2026-09-02).
# Seeded env vars are handled separately by seed-secrets.sh, which CI re-runs
# after every deploy. Explicit --image / --registry-* args still win.

# Resolve the name suffix the same way seed-secrets.sh does: explicit --suffix,
# else the `param nameSuffix = '...'` line in the environment's bicepparam.
RESOLVED_SUFFIX="$NAME_SUFFIX"
if [[ -z "$RESOLVED_SUFFIX" && -f "$PARAMS_FILE" ]]; then
  RESOLVED_SUFFIX=$(grep -E "^\s*param\s+nameSuffix\s*=" "$PARAMS_FILE" \
    | sed -E "s/.*=\s*'([^']+)'.*/\1/" | head -n1)
fi

DISCOVER_RG="rg-santarun-${ENVIRONMENT}-${RESOLVED_SUFFIX}"
DISCOVER_APP="santarun-app-${RESOLVED_SUFFIX}"
DISCOVERED_IMAGE=""
DISCOVERED_DOMAIN=""
DISCOVERED_CERT_ID=""

if [[ -n "$RESOLVED_SUFFIX" ]] && az containerapp show -g "$DISCOVER_RG" -n "$DISCOVER_APP" &>/dev/null; then
  echo "🔎 Reading live state from '$DISCOVER_APP' to preserve it across the deploy..."

  LIVE_IMAGE=$(az containerapp show -g "$DISCOVER_RG" -n "$DISCOVER_APP" \
    --query "properties.template.containers[0].image" -o tsv 2>/dev/null || true)
  if [[ -n "$LIVE_IMAGE" && "$LIVE_IMAGE" != mcr.microsoft.com/k8se/quickstart* ]]; then
    DISCOVERED_IMAGE="$LIVE_IMAGE"
    echo "   image        : $DISCOVERED_IMAGE"
  fi

  # First bound custom domain + its certificate (single-domain setup).
  DISCOVERED_DOMAIN=$(az containerapp show -g "$DISCOVER_RG" -n "$DISCOVER_APP" \
    --query "properties.configuration.ingress.customDomains[0].name" -o tsv 2>/dev/null || true)
  DISCOVERED_CERT_ID=$(az containerapp show -g "$DISCOVER_RG" -n "$DISCOVER_APP" \
    --query "properties.configuration.ingress.customDomains[0].certificateId" -o tsv 2>/dev/null || true)
  if [[ -n "$DISCOVERED_DOMAIN" && -n "$DISCOVERED_CERT_ID" ]]; then
    echo "   custom domain: $DISCOVERED_DOMAIN"
  elif [[ -n "$DISCOVERED_DOMAIN" ]]; then
    echo "   ⚠️  custom domain '$DISCOVERED_DOMAIN' is bound without a certificate — not preserved."
    DISCOVERED_DOMAIN=""
  fi
  echo ""
fi

# ─── Deploy ──────────────────────────────────────────────────────────────────

DEPLOYMENT_NAME="santarun-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)"

EXTRA_PARAM_ARGS=()
[[ -n "$NAME_SUFFIX" ]] && EXTRA_PARAM_ARGS+=("nameSuffix=$NAME_SUFFIX")
[[ -n "$LOCATION" ]] && EXTRA_PARAM_ARGS+=("location=$LOCATION")
[[ -n "$CIAM_DIRECTORY_NAME" ]] && EXTRA_PARAM_ARGS+=("ciamDirectoryName=$CIAM_DIRECTORY_NAME")

# Explicit --image wins; otherwise fall back to the discovered running image.
EFFECTIVE_IMAGE="${CONTAINER_IMAGE:-$DISCOVERED_IMAGE}"
[[ -n "$EFFECTIVE_IMAGE" ]] && EXTRA_PARAM_ARGS+=("containerImage=$EFFECTIVE_IMAGE")
[[ -n "$REGISTRY_SERVER" ]] && EXTRA_PARAM_ARGS+=("registryServer=$REGISTRY_SERVER")
[[ -n "$REGISTRY_USERNAME" ]] && EXTRA_PARAM_ARGS+=("registryUsername=$REGISTRY_USERNAME")
[[ -n "${REGISTRY_PASSWORD:-}" ]] && EXTRA_PARAM_ARGS+=("registryPassword=$REGISTRY_PASSWORD")

# Re-assert the discovered custom-domain binding unless the param file already
# pins one (a non-empty customDomainName there takes precedence).
PARAMFILE_DOMAIN=""
if [[ -f "$PARAMS_FILE" ]]; then
  PARAMFILE_DOMAIN=$( (grep -E "^\s*param\s+customDomainName\s*=" "$PARAMS_FILE" || true) \
    | sed -E "s/.*=\s*'([^']*)'.*/\1/" | head -n1)
fi
if [[ -z "$PARAMFILE_DOMAIN" && -n "$DISCOVERED_DOMAIN" && -n "$DISCOVERED_CERT_ID" ]]; then
  EXTRA_PARAM_ARGS+=("customDomainName=$DISCOVERED_DOMAIN")
  EXTRA_PARAM_ARGS+=("customDomainCertificateId=$DISCOVERED_CERT_ID")
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo "🔍 Validating Bicep template (dry run)..."
  az deployment sub validate \
    --location "$LOCATION" \
    --name "$DEPLOYMENT_NAME" \
    --template-file "${SCRIPT_DIR}/main.bicep" \
    --parameters "$PARAMS_FILE" \
    --parameters "${EXTRA_PARAM_ARGS[@]}" \
    --output table
  echo ""
  echo "✅ Template is valid."
else
  echo "🚀 Starting deployment '$DEPLOYMENT_NAME'..."
  echo ""
  DEPLOY_OUTPUT=$(az deployment sub create \
    --location "$LOCATION" \
    --name "$DEPLOYMENT_NAME" \
    --template-file "${SCRIPT_DIR}/main.bicep" \
    --parameters "$PARAMS_FILE" \
    --parameters "${EXTRA_PARAM_ARGS[@]}" \
    --output json)

  echo ""
  echo "======================================"
  echo "  ✅ Deployment Complete!"
  echo "======================================"
  echo ""
  echo "Resources deployed:"
  python3 -c "
import json, sys
data = json.load(sys.stdin)
outputs = data.get('properties', {}).get('outputs', {})
rg = outputs.get('resourceGroupName', {}).get('value', 'N/A')
print(f'  Resource Group : {rg}')
app_name = outputs.get('containerAppName', {}).get('value', 'N/A')
print(f'  Container App  : {app_name}')
url = outputs.get('appUrl', {}).get('value', 'N/A')
print(f'  App URL        : {url}')
" <<< "$DEPLOY_OUTPUT" 2>/dev/null || true
  echo ""

  echo "======================================"
  echo "  📝 Next Steps — Configure CI + Secrets"
  echo "======================================"
  echo ""
  echo "Add these to GitHub → Settings → Secrets and variables → Actions:"
  echo ""
  python3 -c "
import json, sys
data = json.load(sys.stdin)
outputs = data.get('properties', {}).get('outputs', {})

app_name = outputs.get('containerAppName', {}).get('value', '')
if app_name:
    print('  GitHub Variable (not a secret): AZURE_CONTAINER_APP_NAME')
    print(f'  Value: {app_name}')
    print()

storage_conn = outputs.get('storageConnectionString', {}).get('value', '')
if storage_conn:
    print('  (seeded automatically below) AZURE_STORAGE_CONNECTION_STRING')
    print(f'  Value: {storage_conn[:60]}...')
    print()
" <<< "$DEPLOY_OUTPUT" 2>/dev/null || true

  echo "CI deploys new images via 'az containerapp update --image ...', which needs"
  echo "either OIDC federated credentials (recommended, no stored secret) or a"
  echo "service principal saved as the AZURE_CREDENTIALS secret — see infra/README.md."
  echo ""
  echo "For full connection string values, run:"
  echo "  az deployment sub show --name '$DEPLOYMENT_NAME' --query 'properties.outputs'"
  echo ""

  # ── Seed Container App environment variables ─────────────────────────────
  # Delegated to seed-secrets.sh so the same idempotent logic can be re-run
  # standalone (e.g. after changing SUITE_AUTH_URL) without a full redeploy. It
  # reads the live Storage connection string itself and pulls suite-auth/
  # VAPID secrets from infra/.env.$ENVIRONMENT (gitignored) or the shell env.
  echo "Seeding Container App environment variables..."
  SEED_ARGS=(--env "$ENVIRONMENT")
  [[ -n "$NAME_SUFFIX" ]] && SEED_ARGS+=(--suffix "$NAME_SUFFIX")
  if [[ -x "${SCRIPT_DIR}/seed-secrets.sh" ]]; then
    "${SCRIPT_DIR}/seed-secrets.sh" "${SEED_ARGS[@]}" \
      || echo "⚠️  Secret seeding failed. Run infra/seed-secrets.sh manually once resources are ready."
  else
    echo "⚠️  infra/seed-secrets.sh not found or not executable; skipping settings seed."
  fi

  echo ""
  echo "See infra/README.md for full configuration instructions."
fi
