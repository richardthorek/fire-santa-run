#!/usr/bin/env bash
#
# backup-tables.sh — export every Azure Table to timestamped JSON in the
# storage account's `backups` blob container.
#
# Why this exists: Azure Table Storage has no soft-delete and no point-in-time
# restore. One bad migration, one wrong `az storage table delete`, or one buggy
# write path in early December can wipe every brigade's routes, memberships, and
# subscriptions days before their run — with printed QR posters pointing at dead
# routes. This nightly export is the recovery path. Blob soft-delete + versioning
# (see infra/modules/storage.bicep) protect the exports themselves.
#
# Auth: uses the storage account key (fetched via the control plane), so the
# caller only needs Contributor/`listKeys` on the resource group — the same
# identity the deploy workflow already uses. No data-plane RBAC required.
#
# Usage:
#   RESOURCE_GROUP=<rg> [STORAGE_ACCOUNT=<name>] [RETENTION_DAYS=30] \
#     infra/backup/backup-tables.sh
#
# Restore is a manual, deliberate act: download the JSON for a table and replay
# its entities with `az storage entity insert` (or the app's own import). We do
# NOT auto-restore — that would risk clobbering good data.

set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:?RESOURCE_GROUP is required}"
CONTAINER="${BACKUP_CONTAINER:-backups}"

# Resolve the storage account name if not passed (the Bicep names it santarun<suffix>).
STORAGE_ACCOUNT="${STORAGE_ACCOUNT:-}"
if [[ -z "$STORAGE_ACCOUNT" ]]; then
  STORAGE_ACCOUNT="$(az storage account list -g "$RESOURCE_GROUP" --query "[?starts_with(name, 'santarun')].name | [0]" -o tsv)"
fi
if [[ -z "$STORAGE_ACCOUNT" ]]; then
  echo "::error::Could not resolve a storage account in resource group '$RESOURCE_GROUP'." >&2
  exit 1
fi

echo "Backing up tables from storage account: $STORAGE_ACCOUNT (rg: $RESOURCE_GROUP)"

ACCOUNT_KEY="$(az storage account keys list -g "$RESOURCE_GROUP" -n "$STORAGE_ACCOUNT" --query "[0].value" -o tsv)"
AZ_AUTH=(--account-name "$STORAGE_ACCOUNT" --account-key "$ACCOUNT_KEY")

# Make sure the destination container exists (Bicep creates it, but be safe).
az storage container create --name "$CONTAINER" "${AZ_AUTH[@]}" --only-show-errors >/dev/null

STAMP="$(date -u +%Y/%m/%d/%H%M%SZ)"
OUTDIR="$(mktemp -d)"
trap 'rm -rf "$OUTDIR"' EXIT

mapfile -t TABLES < <(az storage table list "${AZ_AUTH[@]}" --query "[].name" -o tsv)
if [[ ${#TABLES[@]} -eq 0 ]]; then
  echo "No tables found — nothing to back up."
  exit 0
fi

TOTAL_ENTITIES=0
for table in "${TABLES[@]}"; do
  echo "  · exporting $table"
  # Page through entities with the continuation marker so large tables export in
  # full, accumulating each page's .items into one JSON array per table.
  marker=""
  first=true
  {
    echo '['
    while :; do
      if [[ -n "$marker" ]]; then
        page="$(az storage entity query --table-name "$table" "${AZ_AUTH[@]}" --marker "$marker" -o json)"
      else
        page="$(az storage entity query --table-name "$table" "${AZ_AUTH[@]}" -o json)"
      fi
      # Emit this page's items (comma-separated across pages).
      items="$(echo "$page" | jq -c '.items[]?')"
      if [[ -n "$items" ]]; then
        while IFS= read -r item; do
          if $first; then first=false; else echo ','; fi
          printf '%s' "$item"
        done <<< "$items"
      fi
      marker="$(echo "$page" | jq -r '.nextMarker // empty')"
      [[ -z "$marker" ]] && break
    done
    echo
    echo ']'
  } > "$OUTDIR/$table.json"
  count="$(jq 'length' "$OUTDIR/$table.json")"
  TOTAL_ENTITIES=$((TOTAL_ENTITIES + count))
  echo "    $count entities"
done

# Small manifest so a restore knows what a backup contained at a glance.
jq -n \
  --arg account "$STORAGE_ACCOUNT" \
  --arg stamp "$STAMP" \
  --argjson tables "$(printf '%s\n' "${TABLES[@]}" | jq -R . | jq -s .)" \
  --argjson total "$TOTAL_ENTITIES" \
  '{account: $account, takenAt: $stamp, tables: $tables, totalEntities: $total}' \
  > "$OUTDIR/_manifest.json"

echo "Uploading ${#TABLES[@]} tables ($TOTAL_ENTITIES entities) to $CONTAINER/$STAMP/ …"
az storage blob upload-batch \
  --destination "$CONTAINER" \
  --destination-path "$STAMP" \
  --source "$OUTDIR" \
  "${AZ_AUTH[@]}" \
  --overwrite \
  --only-show-errors >/dev/null

echo "Backup complete: $CONTAINER/$STAMP/ ($TOTAL_ENTITIES entities across ${#TABLES[@]} tables)"
