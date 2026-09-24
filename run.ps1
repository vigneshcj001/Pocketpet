# Launch PocketPet from the current source.
#   .\run.ps1            debug build (fast to compile)
#   .\run.ps1 -Release   optimised build
param([switch]$Release)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "scripts\init-rust.ps1")

Push-Location (Join-Path $PSScriptRoot "src-tauri")
try {
    if ($Release) { cargo run --release } else { cargo run }
    if ($LASTEXITCODE -ne 0) { throw "PocketPet failed (exit $LASTEXITCODE)." }
} finally {
    Pop-Location
}
