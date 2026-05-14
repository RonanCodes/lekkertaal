#!/usr/bin/env bash
# Run `pnpm dev` with DEV_BYPASS_AUTH=true in .dev.vars for the lifetime of
# the dev session. On exit (Ctrl+C / kill), restore the original .dev.vars
# so the flag is never accidentally left on.
#
# Usage:
#   pnpm dev:bypass-auth
#
# Reads/writes:
#   .dev.vars               — toggled to DEV_BYPASS_AUTH=true while running
#   .dev.vars.swap-bypass   — temp backup, removed on clean exit
#
# Why a script instead of a one-liner env var:
#   The auth helper reads `env.DEV_BYPASS_AUTH` from the Cloudflare Worker
#   binding, which on dev is sourced from `.dev.vars` (not process.env).
#   See src/lib/server/auth-helper.ts.
set -euo pipefail

DEV_VARS=".dev.vars"
BACKUP="${DEV_VARS}.swap-bypass"

if [ ! -f "$DEV_VARS" ]; then
  echo "ERROR: $DEV_VARS not found. Are you in the lekkertaal project root?" >&2
  exit 1
fi

# Snapshot original .dev.vars
cp "$DEV_VARS" "$BACKUP"

# Restore on any exit (Ctrl+C, kill, normal exit, error)
cleanup() {
  if [ -f "$BACKUP" ]; then
    mv "$BACKUP" "$DEV_VARS"
    echo ""
    echo "[dev:bypass-auth] restored .dev.vars (DEV_BYPASS_AUTH off)"
  fi
}
trap cleanup EXIT INT TERM

# Strip any existing DEV_BYPASS_AUTH line + add fresh =true line
grep -v "^#*[[:space:]]*DEV_BYPASS_AUTH=" "$BACKUP" > "$DEV_VARS" || true
echo "DEV_BYPASS_AUTH=true" >> "$DEV_VARS"

echo "[dev:bypass-auth] DEV_BYPASS_AUTH=true active for this session"
echo "[dev:bypass-auth] auto-signed in as seed_ronan (see seed/users.json)"
echo "[dev:bypass-auth] press Ctrl+C to stop and restore .dev.vars"
echo ""

pnpm dev
