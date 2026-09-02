#!/usr/bin/env bash
# Fire Santa Run — seed the Azure AI Content Safety text blocklist.
#
# Creates (or updates) a Content Safety text blocklist named `profanity` and
# fills it from infra/content-safety-blocklist.txt. server/src/utils/
# contentSafety.ts applies this blocklist to public run/brigade names by
# default (CONTENT_SAFETY_BLOCKLIST) — the harm categories miss plain profanity.
#
# The blocklist is data on the Content Safety account, not IaC, so run this
# once after the account is first provisioned (and again whenever the term list
# changes). It is idempotent — addOrUpdateBlocklistItems replaces by text.
#
# Usage:
#   ./infra/seed-content-safety-blocklist.sh                 # dev (suffix from dev.bicepparam)
#   ./infra/seed-content-safety-blocklist.sh --env prod
#   ./infra/seed-content-safety-blocklist.sh --account santarun-cs-dev003 --resource-group rg-santarun-dev-dev003
#   ./infra/seed-content-safety-blocklist.sh --dry-run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_VERSION="2024-09-01"
BLOCKLIST_NAME="profanity"
TERMS_FILE="${SCRIPT_DIR}/content-safety-blocklist.txt"

ENVIRONMENT="dev"
NAME_SUFFIX=""
ACCOUNT=""
RESOURCE_GROUP=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --env|-e)            ENVIRONMENT="$2"; shift 2 ;;
    --suffix|-s)         NAME_SUFFIX="$2"; shift 2 ;;
    --account)           ACCOUNT="$2"; shift 2 ;;
    --resource-group|-g) RESOURCE_GROUP="$2"; shift 2 ;;
    --dry-run)           DRY_RUN=true; shift ;;
    --help|-h)
      sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "❌ Unknown option: $1"; exit 1 ;;
  esac
done

# Resolve account + resource group if not given explicitly.
if [[ -z "$ACCOUNT" || -z "$RESOURCE_GROUP" ]]; then
  if [[ -z "$NAME_SUFFIX" ]]; then
    PARAMS_FILE="${SCRIPT_DIR}/parameters/${ENVIRONMENT}.bicepparam"
    [[ -f "$PARAMS_FILE" ]] && NAME_SUFFIX=$(grep -E "^\s*param\s+nameSuffix\s*=" "$PARAMS_FILE" \
      | sed -E "s/.*=\s*'([^']+)'.*/\1/" | head -n1)
  fi
  [[ -z "$NAME_SUFFIX" ]] && { echo "❌ Could not resolve the name suffix. Pass --suffix, or --account + --resource-group."; exit 1; }
  ACCOUNT="${ACCOUNT:-santarun-cs-${NAME_SUFFIX}}"
  RESOURCE_GROUP="${RESOURCE_GROUP:-rg-santarun-${ENVIRONMENT}-${NAME_SUFFIX}}"
fi

[[ -f "$TERMS_FILE" ]] || { echo "❌ Terms file not found: $TERMS_FILE"; exit 1; }

echo "  Account        : $ACCOUNT"
echo "  Resource group : $RESOURCE_GROUP"
echo "  Blocklist      : $BLOCKLIST_NAME"

ENDPOINT=$(az cognitiveservices account show --name "$ACCOUNT" --resource-group "$RESOURCE_GROUP" \
  --query properties.endpoint --output tsv 2>/dev/null || true)
KEY=$(az cognitiveservices account keys list --name "$ACCOUNT" --resource-group "$RESOURCE_GROUP" \
  --query key1 --output tsv 2>/dev/null || true)
[[ -n "$ENDPOINT" && -n "$KEY" ]] || { echo "❌ Could not read the Content Safety endpoint/key. Is the account provisioned?"; exit 1; }
ENDPOINT="${ENDPOINT%/}"

# Build the JSON payload from the terms file (skip blanks + comments).
ITEMS_JSON=$(grep -vE '^\s*(#|$)' "$TERMS_FILE" | python3 -c '
import json, sys
terms = [line.strip() for line in sys.stdin if line.strip()]
print(json.dumps({"blocklistItems": [{"text": t} for t in terms]}))
')
COUNT=$(printf '%s' "$ITEMS_JSON" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)["blocklistItems"]))')
echo "  Terms          : $COUNT"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "🔍 Dry run — no changes applied."
  exit 0
fi

echo "→ Creating/updating blocklist..."
curl -sS -X PATCH "$ENDPOINT/contentsafety/text/blocklists/$BLOCKLIST_NAME?api-version=$API_VERSION" \
  -H "Ocp-Apim-Subscription-Key: $KEY" -H "Content-Type: application/merge-patch+json" \
  -d '{"description":"Profanity + slurs for public run/brigade names — seeded from infra/content-safety-blocklist.txt"}' \
  -o /dev/null -w "  HTTP %{http_code}\n"

echo "→ Adding ${COUNT} items..."
printf '%s' "$ITEMS_JSON" | curl -sS -X POST \
  "$ENDPOINT/contentsafety/text/blocklists/$BLOCKLIST_NAME:addOrUpdateBlocklistItems?api-version=$API_VERSION" \
  -H "Ocp-Apim-Subscription-Key: $KEY" -H "Content-Type: application/json" -d @- \
  -o /dev/null -w "  HTTP %{http_code}\n"

echo "✅ Blocklist '$BLOCKLIST_NAME' seeded. Set CONTENT_SAFETY_BLOCKLIST=$BLOCKLIST_NAME (it is the default)."
