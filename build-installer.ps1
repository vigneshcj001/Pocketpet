# Build a real Windows installer for PocketPet.
# Output: src-tauri\target\release\bundle\nsis\PocketPet_0.1.0_x64-setup.exe
$ErrorActionPreference = "Stop"

# Rust does not have to live in C:\Users\<you>\.cargo - ours is on D:. A terminal opened
# before CARGO_HOME was set will not have it, so fall back to the persisted user value.
$cargoHome  = $env:CARGO_HOME
$rustupHome = $env:RUSTUP_HOME
if (-not $cargoHome)  { $cargoHome  = [Environment]::GetEnvironmentVariable("CARGO_HOME", "User") }
if (-not $rustupHome) { $rustupHome = [Environment]::GetEnvironmentVariable("RUSTUP_HOME", "User") }
if (-not $cargoHome)  { $cargoHome  = Join-Path $env:USERPROFILE ".cargo" }
if (-not $rustupHome) { $rustupHome = Join-Path $env:USERPROFILE ".rustup" }

# cargo and rustc read these to find the registry cache and the toolchain.
$env:CARGO_HOME  = $cargoHome
$env:RUSTUP_HOME = $rustupHome

$cargoBin = Join-Path $cargoHome "bin"
if (Test-Path $cargoBin) { $env:Path = "$cargoBin;$env:Path" }

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Error "cargo not found. Install Rust from https://rustup.rs then reopen this terminal."
}

# The Tauri CLI does the bundling; plain `cargo build` only makes the .exe.
if (-not (Get-Command cargo-tauri -ErrorAction SilentlyContinue)) {
    Write-Host "Installing the Tauri CLI (one time, a few minutes)..." -ForegroundColor Cyan
    cargo install tauri-cli --version "^2" --locked
}

Set-Location (Join-Path $PSScriptRoot "src-tauri")
cargo tauri build

$installer = Get-ChildItem -Recurse -Filter "*-setup.exe" `
    -Path (Join-Path $PSScriptRoot "src-tauri\target\release\bundle") -ErrorAction SilentlyContinue |
    Select-Object -First 1

if ($installer) {
    Write-Host ""
    Write-Host "Installer ready:" -ForegroundColor Green
    Write-Host "  $($installer.FullName)"
} else {
    Write-Warning "Build finished but no installer was found under target\release\bundle."
}
