# Build a Windows installer from the current source.
# Output: src-tauri\target\release\bundle\nsis\PocketPet_<version>_x64-setup.exe
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "scripts\init-rust.ps1")

if (-not (Get-Command cargo-tauri -ErrorAction SilentlyContinue)) {
    Write-Host "Installing the Tauri CLI (one time, a few minutes)..." -ForegroundColor Cyan
    cargo install tauri-cli --version "^2" --locked
    if ($LASTEXITCODE -ne 0) { throw "Installing the Tauri CLI failed (exit $LASTEXITCODE)." }
}

$config = Get-Content (Join-Path $PSScriptRoot "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json
$buildStarted = [DateTime]::UtcNow
Push-Location (Join-Path $PSScriptRoot "src-tauri")
try {
    cargo tauri build --bundles nsis
    if ($LASTEXITCODE -ne 0) {
        throw "PocketPet build failed (exit $LASTEXITCODE). Existing installers are from an earlier build."
    }
} finally {
    Pop-Location
}

$installer = Get-ChildItem -Path (Join-Path $PSScriptRoot "src-tauri\target\release\bundle\nsis") `
    -Filter "PocketPet_$($config.version)_*-setup.exe" -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTimeUtc -ge $buildStarted } |
    Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
if (-not $installer) {
    throw "No new installer for version $($config.version) was produced. Do not install an older file."
}

Write-Host "Installer ready: $($installer.FullName)" -ForegroundColor Green
Write-Host "Run this installer, then reopen PocketPet from your usual shortcut."
Write-Host "Pushing source to GitHub does not update an already installed copy."
