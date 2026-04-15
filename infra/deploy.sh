#!/usr/bin/env bash
# Fire Santa Run — Azure Infrastructure Deployment Script
#
# Deploys (or re-deploys) all Azure resources using Bicep IaC.
# Usage:
#   ./infra/deploy.sh                        # deploy dev environment
#   ./infra/deploy.sh --env prod             # deploy prod environment
#   ./infra/deploy.sh --suffix abc123        # override name suffix
#   ./infra/deploy.sh --env prod --suffix p1 # prod with custom suffix
#   ./infra/deploy.sh --dry-run              # validate without deploying
#   ./infra/deploy.sh --help                 # show this help

set -euo pipefail

# ─── Defaults ────────────────────────────────────────────────────────────────

ENVIRONMENT="dev"
LOCATION="australiaeast"
NAME_SUFFIX=""
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
  --dry-run                  Validate the template without deploying
  --help,   -h               Show this help message

Examples:
  ./infra/deploy.sh                          # Deploy dev environment (free F1 tier)
  ./infra/deploy.sh --env prod --suffix p1   # Deploy production (B1 tier)
  ./infra/deploy.sh --dry-run                # Validate dev template only
HELP
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --env|-e)     ENVIRONMENT="$2"; shift 2 ;;
    --suffix|-s)  NAME_SUFFIX="$2"; shift 2 ;;
    --location)   LOCATION="$2"; shift 2 ;;
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

# ─── Deploy ──────────────────────────────────────────────────────────────────

DEPLOYMENT_NAME="santarun-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)"

EXTRA_PARAM_ARGS=()
[[ -n "$NAME_SUFFIX" ]] && EXTRA_PARAM_ARGS+=("nameSuffix=$NAME_SUFFIX")
[[ -n "$LOCATION" ]] && EXTRA_PARAM_ARGS+=("location=$LOCATION")

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
app_name = outputs.get('appServiceName', {}).get('value', 'N/A')
print(f'  App Service    : {app_name}')
url = outputs.get('appUrl', {}).get('value', 'N/A')
print(f'  App URL        : {url}')
hub = outputs.get('webPubSubHubName', {}).get('value', 'N/A')
print(f'  PubSub Hub     : {hub}')
" <<< "$DEPLOY_OUTPUT" 2>/dev/null || true
  echo ""

  echo "======================================"
  echo "  📝 Next Steps — Configure Secrets"
  echo "======================================"
  echo ""
  echo "Add these to GitHub → Settings → Secrets and variables → Actions:"
  echo ""
  python3 -c "
import json, sys
data = json.load(sys.stdin)
outputs = data.get('properties', {}).get('outputs', {})

app_name = outputs.get('appServiceName', {}).get('value', '')
if app_name:
    print('  GitHub Variable (not a secret): AZURE_APP_SERVICE_NAME')
    print(f'  Value: {app_name}')
    print()

print('  GitHub Secret: AZURE_APP_SERVICE_PUBLISH_PROFILE')
print('  Value: retrieve using:')
print('    az webapp deployment list-publishing-profiles --resource-group <rg> --name <app> --xml')
print()

storage_conn = outputs.get('storageConnectionString', {}).get('value', '')
if storage_conn:
    print('  App Service App Setting: AZURE_STORAGE_CONNECTION_STRING')
    print(f'  Value: {storage_conn[:60]}...')
    print()

pubsub_conn = outputs.get('webPubSubConnectionString', {}).get('value', '')
if pubsub_conn:
    print('  App Service App Setting: AZURE_WEBPUBSUB_CONNECTION_STRING')
    print(f'  Value: {pubsub_conn[:60]}...')
    print()
" <<< "$DEPLOY_OUTPUT" 2>/dev/null || true

  echo "For full connection string values, run:"
  echo "  az deployment sub show --name '$DEPLOYMENT_NAME' --query 'properties.outputs'"
  echo ""

  # ── Set App Service application settings ─────────────────────────────────
  echo "Configuring App Service application settings..."
  RESOURCE_GROUP=$(python3 -c "
import json, sys
data = json.load(sys.stdin)
print(data.get('properties', {}).get('outputs', {}).get('resourceGroupName', {}).get('value', ''))
" <<< "$DEPLOY_OUTPUT" 2>/dev/null || true)

  APP_NAME=$(python3 -c "
import json, sys
data = json.load(sys.stdin)
print(data.get('properties', {}).get('outputs', {}).get('appServiceName', {}).get('value', ''))
" <<< "$DEPLOY_OUTPUT" 2>/dev/null || true)

  STORAGE_CONN=$(python3 -c "
import json, sys
data = json.load(sys.stdin)
print(data.get('properties', {}).get('outputs', {}).get('storageConnectionString', {}).get('value', ''))
" <<< "$DEPLOY_OUTPUT" 2>/dev/null || true)

  PUBSUB_CONN=$(python3 -c "
import json, sys
data = json.load(sys.stdin)
print(data.get('properties', {}).get('outputs', {}).get('webPubSubConnectionString', {}).get('value', ''))
" <<< "$DEPLOY_OUTPUT" 2>/dev/null || true)

  HUB_NAME=$(python3 -c "
import json, sys
data = json.load(sys.stdin)
print(data.get('properties', {}).get('outputs', {}).get('webPubSubHubName', {}).get('value', ''))
" <<< "$DEPLOY_OUTPUT" 2>/dev/null || true)

  PUBLISH_PROFILE=$(az webapp deployment list-publishing-profiles \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --xml 2>/dev/null || true)

  if [[ -n "$PUBLISH_PROFILE" ]]; then
    echo "✅ Publish profile retrieved. Add to GitHub secret AZURE_APP_SERVICE_PUBLISH_PROFILE."
  else
    echo "⚠️  Could not retrieve publish profile automatically. You can fetch it later with:"
    echo "   az webapp deployment list-publishing-profiles --resource-group '$RESOURCE_GROUP' --name '$APP_NAME' --xml"
  fi

  if [[ -n "$RESOURCE_GROUP" && -n "$STORAGE_CONN" ]]; then
    az webapp config appsettings set \
      --resource-group "$RESOURCE_GROUP" \
      --name "$APP_NAME" \
      --settings \
        "AZURE_STORAGE_CONNECTION_STRING=$STORAGE_CONN" \
        "AZURE_WEBPUBSUB_CONNECTION_STRING=$PUBSUB_CONN" \
        "AZURE_WEBPUBSUB_HUB_NAME=$HUB_NAME" \
        "DEV_MODE=false" \
        "NODE_ENV=production" \
        "PORT=8080" \
      --output none && echo "✅ App Service settings configured." || echo "⚠️  Could not set app settings automatically. Set them manually in Azure Portal."
  fi

  echo ""
  echo "See infra/README.md for full configuration instructions."
fi
