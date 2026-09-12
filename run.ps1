# Launch PocketPet.
#   .\run.ps1            debug build (fast to compile, slower to run)
#   .\run.ps1 -Release   optimised build (use this one day to day)
param([switch]$Release)

$ErrorActionPreference = "Stop"

# rustup adds itself to PATH only for shells opened after it installed, so a
# terminal that was already open won't see cargo. Fix it for this session.
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

# Point the MSVC toolchain at the right Visual Studio.
#
# rustc finds link.exe by itself *if* exactly one usable install exists. With
# both VS Community (no C++ tools) and Build Tools (with them) side by side it
# can pick the wrong one and report "linker `link.exe` not found". Importing
# vcvars64.bat removes the guesswork: it puts the linker on PATH and sets
# INCLUDE/LIB for the Windows SDK.
if (-not (Get-Command link.exe -ErrorAction SilentlyContinue)) {
    $vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path $vswhere) {
        $vsPath = & $vswhere -products * -all -latest `
            -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
            -format value -property installationPath | Select-Object -First 1

        $vcvars = if ($vsPath) { Join-Path $vsPath "VC\Auxiliary\Build\vcvars64.bat" } else { $null }

        if ($vcvars -and (Test-Path $vcvars)) {
            Write-Host "Loading MSVC environment from $vsPath" -ForegroundColor DarkGray
            # Run vcvars in cmd, dump the resulting environment, copy it back.
            cmd /c "`"$vcvars`" >nul 2>&1 && set" | ForEach-Object {
                if ($_ -match '^([^=]+)=(.*)$') {
                    Set-Item -Path "env:$($matches[1])" -Value $matches[2] -ErrorAction SilentlyContinue
                }
            }
        }
    }
}

if (-not (Get-Command link.exe -ErrorAction SilentlyContinue)) {
    Write-Warning "MSVC linker still not on PATH - the build will likely fail."
}

# The linker is useless without the Windows SDK: no kernel32.lib, no ucrt.
$sdkLib = Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\Lib"
if (-not (Test-Path $sdkLib)) {
    Write-Error @"
The Windows SDK is not installed, so nothing can be linked.

Install it with:
    winget install --id Microsoft.WindowsSDK.10.0.26100 --accept-source-agreements --accept-package-agreements

Then open a NEW terminal and run this script again.
"@
}

Set-Location (Join-Path $PSScriptRoot "src-tauri")

if ($Release) { cargo run --release } else { cargo run }
