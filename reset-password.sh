#!/bin/bash
# Reset a Filament Tracker user's password back to their own username.
#
#   ./reset-password.sh           # list users
#   ./reset-password.sh lasse     # set lasse's password to "lasse"
#
# Runs inside the filament-tracker container (no Node needed on the host).
# The script is copied in first, so no image rebuild is needed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
CONTAINER=filament-tracker

if [ -z "$(docker ps --filter "name=^/${CONTAINER}$" --format '{{.Names}}')" ]; then
  echo "Container '$CONTAINER' is not running. Start it with: docker compose up -d" >&2
  exit 1
fi

# Copy the whole folder — docker cp won't create a missing parent directory.
docker cp "$ROOT/backend/src/scripts" "${CONTAINER}:/app/backend/src/" >/dev/null

docker exec "$CONTAINER" node src/scripts/reset-password.js "$@"
