#!/usr/bin/env bash
# Launch PocketPet from source on macOS or Linux.
#   ./run.sh            debug build (fast to compile)
#   ./run.sh --release  optimised build
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=scripts/check-deps.sh
. scripts/check-deps.sh

cd src-tauri
if [ "${1:-}" = "--release" ] || [ "${1:-}" = "-r" ]; then
  cargo run --release
else
  cargo run
fi
