#!/usr/bin/env bash
# Fire Santa Run — Azure Infrastructure Deployment Script
#
# Deploys (or re-deploys) all Azure resources using Bicep IaC.
# Usage:
#   ./infra/deploy.sh                        # deploy dev environment
#   ./infra/deploy.sh --env prod             # deploy prod environment
#   ./infra/deploy.sh --suffix abc123        # override name suffix
#   ./infra/deploy.sh --env prod --suffix p1 # prod with custom suffix
#   ./infra/deploy.sh --help                 # show this help

set -euo pipefail

# ─── Defaults ────────────────────────────────────────────────────────────────

ENVIRONMENT="dev"
LOCATION="australiaeast"
NAME_SUFFIX=""
PARAMS_FILE=""
DRY_RUN=false

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Argument Parsing ────────────────────────────────────────────────────────

print_help() {
  cat <<EOF
Fire Santa Run — Azure Deployment Script

Usage: ./infra/deploy.sh [OPTIONS]

Options:
  --env,    -e  <dev|prod>   Environment to deploy (default: dev)
  --suffix, -s  <string>     3–8 char alphanumeric suffix for unique resource names
  --location    <region>     Azure region (default: australiaeast)
  --dry-run                  Validate the template without deploying
  --help,   -h               Show this help message

Examples:
  ./infra/deploy.sh                          # Deploy dev environment
  ./infra/deploy.sh --env prod --suffix p1   # Deploy production
  ./infra/deploy.sh --dry-run                # Validate dev template only
EOF
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

# Allow suffix override via CLI; else fall back to value in .bicepparam
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
echo "  Parameters  : ${PARAMS_FILE#"$SCRIPT_DIR/../"}"
echo ""

# Check Azure CLI
if ! command -v az &>/dev/null; then
  echo "❌ Azure CLI is not installed."
  echo "   Install it from: https://docs.microsoft.com/cli/azure/install-azure-cli"
  exit 1
fi

# Check login
if ! az account show &>/dev/null; then
  echo "🔐 Not logged in. Running 'az login'..."
  az login
fi

SUBSCRIPTION=$(az account show --query name --output tsv)
SUBSCRIPTION_ID=$(az account show --query id --output tsv)
echo "  Subscription: $SUBSCRIPTION ($SUBSCRIPTION_ID)"
echo ""

# Confirm before prod deployments
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

# Build parameter overrides
EXTRA_PARAMS=""
[[ -n "$NAME_SUFFIX" ]] && EXTRA_PARAMS="$EXTRA_PARAMS nameSuffix='$NAME_SUFFIX'"
[[ -n "$LOCATION" ]] && EXTRA_PARAMS="$EXTRA_PARAMS location='$LOCATION'"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "🔍 Validating Bicep template (dry run)..."
  az deployment sub validate \
    --location "$LOCATION" \
    --name "$DEPLOYMENT_NAME" \
    --template-file "${SCRIPT_DIR}/main.bicep" \
    --parameters "$PARAMS_FILE" \
    ${EXTRA_PARAMS:+--parameters $EXTRA_PARAMS} \
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
    ${EXTRA_PARAMS:+--parameters $EXTRA_PARAMS} \
    --output json)

  echo ""
  echo "======================================"
  echo "  ✅ Deployment Complete!"
  echo "======================================"
  echo ""
  echo "Resources deployed:"
  echo "$DEPLOY_OUTPUT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
outputs = data.get('properties', {}).get('outputs', {})
rg = outputs.get('resourceGroupName', {}).get('value', 'N/A')
print(f'  Resource Group : {rg}')
url = outputs.get('appUrl', {}).get('value', 'N/A')
print(f'  App URL        : {url}')
hub = outputs.get('webPubSubHubName', {}).get('value', 'N/A')
print(f'  PubSub Hub     : {hub}')
" 2>/dev/null || true
  echo ""
  echo "======================================"
  echo "  📝 Next Steps — Configure Secrets"
  echo "======================================"
  echo ""
  echo "The following secrets must be added to your GitHub repository"
  echo "(Settings > Secrets and variables > Actions):"
  echo ""

  # Extract and display connection strings
  python3 -c "
import json, sys
data = json.load(sys.stdin)
outputs = data.get('properties', {}).get('outputs', {})

swa_token = outputs.get('staticWebAppDeploymentToken', {}).get('value', '')
if swa_token:
    print('  GitHub Secret: AZURE_STATIC_WEB_APPS_API_TOKEN')
    print(f'  Value: {swa_token[:20]}... (see deployment output for full value)')
    print()

storage_conn = outputs.get('storageConnectionString', {}).get('value', '')
if storage_conn:
    print('  GitHub Secret: AZURE_STORAGE_CONNECTION_STRING')
    print(f'  Value: {storage_conn[:60]}...')
    print()

pubsub_conn = outputs.get('webPubSubConnectionString', {}).get('value', '')
if pubsub_conn:
    print('  GitHub Secret: AZURE_WEBPUBSUB_CONNECTION_STRING')
    print(f'  Value: {pubsub_conn[:60]}...')
    print()
" <<< "$DEPLOY_OUTPUT" 2>/dev/null || true

  echo "For full connection string values, run:"
  echo "  az deployment sub show --name '$DEPLOYMENT_NAME' --query 'properties.outputs'"
  echo ""
  echo "See infra/README.md for full configuration instructions."
fi
