#!/bin/bash
# Rename a Filament Tracker user (e.g. to fix a first-time-setup typo).
#
#   ./rename-user.sh                      # list users
#   ./rename-user.sh Guvballe Gulvballe   # rename Guvballe -> Gulvballe
#
# The password is NOT changed by a rename — run ./reset-password.sh <new-name>
# afterwards if you want the password to match the new username again.
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

docker exec "$CONTAINER" node src/scripts/rename-user.js "$@"
