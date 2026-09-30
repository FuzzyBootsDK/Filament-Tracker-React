# Rename a Filament Tracker user (e.g. to fix a first-time-setup typo).
#
#   .\rename-user.ps1                        # list users
#   .\rename-user.ps1 Guvballe Gulvballe     # rename Guvballe -> Gulvballe
#
# The password is NOT changed by a rename — run .\reset-password.ps1 <new-name>
# afterwards if you want the password to match the new username again.
#
# Node isn't installed on the host, so this runs inside the filament-tracker
# container. The script is copied in first, so no image rebuild is needed.
param([string]$OldUsername, [string]$NewUsername)

$ErrorActionPreference = 'Stop'
$container = 'filament-tracker'
$scriptDir = Join-Path $PSScriptRoot 'backend\src\scripts'

if (-not (docker ps --filter "name=^/$container$" --format '{{.Names}}')) {
    Write-Error "Container '$container' is not running. Start it with: docker compose up -d"
}

# Copy the whole folder — docker cp won't create a missing parent directory.
docker cp $scriptDir "${container}:/app/backend/src/" | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to copy the script into '$container'." }

if ($OldUsername -and $NewUsername) {
    docker exec $container node src/scripts/rename-user.js $OldUsername $NewUsername
} else {
    docker exec $container node src/scripts/rename-user.js
}
