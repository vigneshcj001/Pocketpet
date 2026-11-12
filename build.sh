#!/usr/bin/env bash
# Build installable packages from source on macOS or Linux.
#   ./build.sh                 the default packages for this OS
#   ./build.sh deb             only the given bundle types (comma-separated)
# macOS → .dmg (and .app); Linux → .deb, .rpm and .AppImage.
# Windows users run .\build-installer.ps1 instead.
set -euo pipefail
cd "$(dirname "$0")"
. scripts/check-deps.sh

case "$(uname -s)" in
  Darwin) default_bundles="app,dmg" ;;
  Linux)  default_bundles="deb,rpm,appimage" ;;
  *) echo "Unsupported OS $(uname -s). On Windows run .\build-installer.ps1." >&2; exit 1 ;;
esac
bundles="${1:-$default_bundles}"

if ! cargo tauri --version >/dev/null 2>&1; then
  echo "Installing the Tauri CLI (one time, a few minutes)..."
  cargo install tauri-cli --version "^2" --locked
fi

(cd src-tauri && cargo tauri build --bundles "$bundles")

echo
echo "Packages are in src-tauri/target/release/bundle/:"
find src-tauri/target/release/bundle -maxdepth 2 -type f \
  \( -name '*.dmg' -o -name '*.deb' -o -name '*.rpm' -o -name '*.AppImage' \) -newer src-tauri/Cargo.toml -print 2>/dev/null || true
