#!/usr/bin/env bash
# Fire Santa Run — seasonal capacity switch
#
# Santa runs are hyper-seasonal: December wants a warm, cold-start-free
# Container App; the other eleven months are happy to scale to zero. This
# script flips the Container App's minimum replica count between the two
# profiles:
#
#   season    : minReplicas=1 — the app never scales to zero, so no viewer or
#               broadcaster ever eats a cold-start delay (typically a few
#               seconds) mid-run.
#   offseason : minReplicas=0 — scale-to-zero; the next request after a quiet
#               spell pays one cold start, then stays warm.
#
# maxReplicas is intentionally NOT a flag here: it is fixed at 1 in the Bicep
# module because the realtime hub (viewer/broadcaster/editor WebSocket sets,
# live viewer counts) lives in this process's memory — see
# infra/modules/containerapps.bicep and docs/ARCHITECTURE.md. Raise it only
# after adding a shared backplane for the hub.
#
# Usage:
#   ./infra/scale-season.sh --rg rg-santarun-prod-prod1 season      # ~Dec 1
#   ./infra/scale-season.sh --rg rg-santarun-prod-prod1 offseason   # ~Jan 7
#
# Cost guide (indicative): a warm minReplicas=1 replica at the smallest
# Consumption size (0.25 vCPU / 0.5 GiB) costs roughly USD 3–6/month if left
# on year-round; scaling to zero for eleven months makes that cost close to
# nothing. This script is what keeps the "warm" cost seasonal instead of
# year-round.

set -euo pipefail

RESOURCE_GROUP=""
MODE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --rg)              RESOURCE_GROUP="$2"; shift 2 ;;
    season|offseason)  MODE="$1"; shift ;;
    --help|-h)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "❌ Unknown option: $1 (use --help)"; exit 1 ;;
  esac
done

if [[ -z "$RESOURCE_GROUP" || -z "$MODE" ]]; then
  echo "❌ Usage: $0 --rg <resource-group> <season|offseason>"
  exit 1
fi

APP_NAME=$(az containerapp list --resource-group "$RESOURCE_GROUP" --query '[0].name' --output tsv)
if [[ -z "$APP_NAME" ]]; then
  echo "❌ No Container App found in $RESOURCE_GROUP"
  exit 1
fi

if [[ "$MODE" == "season" ]]; then
  echo "🎄 Scaling UP for the season: $APP_NAME → minReplicas=1 (always warm)"
  az containerapp update \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --min-replicas 1 \
    --max-replicas 1 \
    --output none
  echo "✅ $APP_NAME is warm — no cold starts during runs."
else
  echo "🌏 Scaling DOWN for the off-season: $APP_NAME → minReplicas=0 (scale-to-zero)"
  az containerapp update \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --min-replicas 0 \
    --max-replicas 1 \
    --output none
  echo "✅ $APP_NAME scales to zero when idle."
fi

echo ""
echo "Done. Remember the other seasonal checklist items:"
echo "  • Mapbox: watch map-load usage (Statistics page) — 50k loads/month free,"
echo "    then ~US\$5 per 1,000. Every public viewer session is one load."
echo "  • App Insights: confirm the daily cap still fits December traffic."
