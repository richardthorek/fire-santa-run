#!/usr/bin/env bash
# Fire Santa Run — seasonal capacity switch
#
# Santa runs are hyper-seasonal: December needs real capacity, the other
# eleven months don't. This script flips the two capacity-sensitive resources
# between "season" (December) and "offseason" profiles:
#
#   Web PubSub :  Free_F1 (20 concurrent connections — NOT enough for a live
#                 run) ↔ Standard_S1 (1,000 concurrent connections per unit).
#                 One popular run alone will exceed the free tier, so scaling
#                 up before the first December run is REQUIRED, not optional.
#   App Service:  B1 (always-on, custom domain) ↔ B1 (unchanged by default —
#                 custom domains require Basic+, so we never drop to F1; pass
#                 --app-sku to override).
#
# Usage:
#   ./infra/scale-season.sh --rg rg-santarun-prod-prod1 season      # ~Dec 1
#   ./infra/scale-season.sh --rg rg-santarun-prod-prod1 offseason   # ~Jan 7
#   ./infra/scale-season.sh --rg <rg> season --pubsub-units 2       # >1k viewers
#
# Cost guide (AUD, indicative):
#   Standard_S1 Web PubSub ≈ $2.40/day/unit → a Dec 1 – Jan 5 season ≈ $85/unit.
#   Leaving it on year-round ≈ $900 — that difference is most of the app's
#   annual running cost, hence this script.

set -euo pipefail

RESOURCE_GROUP=""
MODE=""
PUBSUB_UNITS=1
APP_SKU=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --rg)            RESOURCE_GROUP="$2"; shift 2 ;;
    --pubsub-units)  PUBSUB_UNITS="$2"; shift 2 ;;
    --app-sku)       APP_SKU="$2"; shift 2 ;;
    season|offseason) MODE="$1"; shift ;;
    --help|-h)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "❌ Unknown option: $1 (use --help)"; exit 1 ;;
  esac
done

if [[ -z "$RESOURCE_GROUP" || -z "$MODE" ]]; then
  echo "❌ Usage: $0 --rg <resource-group> <season|offseason> [--pubsub-units N] [--app-sku SKU]"
  exit 1
fi

PUBSUB_NAME=$(az webpubsub list --resource-group "$RESOURCE_GROUP" --query '[0].name' --output tsv)
if [[ -z "$PUBSUB_NAME" ]]; then
  echo "❌ No Web PubSub resource found in $RESOURCE_GROUP"
  exit 1
fi

if [[ "$MODE" == "season" ]]; then
  echo "🎄 Scaling UP for the season: $PUBSUB_NAME → Standard_S1 x$PUBSUB_UNITS"
  az webpubsub update \
    --resource-group "$RESOURCE_GROUP" \
    --name "$PUBSUB_NAME" \
    --sku Standard_S1 \
    --unit-count "$PUBSUB_UNITS" \
    --output none
  echo "✅ Web PubSub at Standard_S1 x$PUBSUB_UNITS ($((PUBSUB_UNITS * 1000)) concurrent connections)."
else
  echo "🌏 Scaling DOWN for the off-season: $PUBSUB_NAME → Free_F1"
  az webpubsub update \
    --resource-group "$RESOURCE_GROUP" \
    --name "$PUBSUB_NAME" \
    --sku Free_F1 \
    --unit-count 1 \
    --output none
  echo "✅ Web PubSub at Free_F1 (20 concurrent connections — dev/testing only)."
fi

if [[ -n "$APP_SKU" ]]; then
  PLAN_NAME=$(az appservice plan list --resource-group "$RESOURCE_GROUP" --query '[0].name' --output tsv)
  echo "Scaling App Service plan $PLAN_NAME → $APP_SKU"
  az appservice plan update \
    --resource-group "$RESOURCE_GROUP" \
    --name "$PLAN_NAME" \
    --sku "$APP_SKU" \
    --output none
  echo "✅ App Service plan at $APP_SKU."
fi

echo ""
echo "Done. Remember the other seasonal checklist items:"
echo "  • Mapbox: watch map-load usage (Statistics page) — 50k loads/month free,"
echo "    then ~US\$5 per 1,000. Every public viewer session is one load."
echo "  • App Insights: confirm the daily cap still fits December traffic."
