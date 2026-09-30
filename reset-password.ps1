# Reset a Filament Tracker user's password back to their own username.
#
#   .\reset-password.ps1           # list users
#   .\reset-password.ps1 lasse     # set lasse's password to "lasse"
#
# Node isn't installed on the host, so this runs inside the filament-tracker
# container. The script is copied in first, so no image rebuild is needed.
param([string]$Username)

$ErrorActionPreference = 'Stop'
$container = 'filament-tracker'
$scriptDir = Join-Path $PSScriptRoot 'backend\src\scripts'

if (-not (docker ps --filter "name=^/$container$" --format '{{.Names}}')) {
    Write-Error "Container '$container' is not running. Start it with: docker compose up -d"
}

# Copy the whole folder — docker cp won't create a missing parent directory.
docker cp $scriptDir "${container}:/app/backend/src/" | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to copy the script into '$container'." }

if ($Username) {
    docker exec $container node src/scripts/reset-password.js $Username
} else {
    docker exec $container node src/scripts/reset-password.js
}
