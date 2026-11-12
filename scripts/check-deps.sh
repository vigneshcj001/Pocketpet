#!/usr/bin/env bash
# Shared prerequisite check for run.sh and build.sh (macOS and Linux).
# Sourced, so it only reports; it never installs system packages for you.

# rustup adds itself to PATH only for shells started after it installed.
if ! command -v cargo >/dev/null 2>&1 && [ -x "${CARGO_HOME:-$HOME/.cargo}/bin/cargo" ]; then
  export PATH="${CARGO_HOME:-$HOME/.cargo}/bin:$PATH"
fi
if ! command -v cargo >/dev/null 2>&1; then
  echo "cargo not found. Install Rust from https://rustup.rs and open a new terminal." >&2
  exit 1
fi

case "$(uname -s)" in
  Darwin)
    if ! xcode-select -p >/dev/null 2>&1; then
      echo "Xcode command-line tools are missing. Run: xcode-select --install" >&2
      exit 1
    fi
    ;;
  Linux)
    if command -v pkg-config >/dev/null 2>&1; then
      missing=""
      for lib in webkit2gtk-4.1 gtk+-3.0 x11 xtst dbus-1; do
        pkg-config --exists "$lib" || missing="$missing $lib"
      done
      if [ -n "$missing" ]; then
        echo "Missing development libraries:$missing" >&2
        echo "Debian/Ubuntu: sudo apt install libwebkit2gtk-4.1-dev build-essential libxdo-dev libssl-dev \\" >&2
        echo "  libayatana-appindicator3-dev librsvg2-dev patchelf libx11-dev libxtst-dev libdbus-1-dev" >&2
        echo "Fedora:        sudo dnf install webkit2gtk4.1-devel openssl-devel libappindicator-gtk3-devel \\" >&2
        echo "  librsvg2-devel libX11-devel libXtst-devel dbus-devel libxdo-devel" >&2
        echo "Arch:          sudo pacman -S webkit2gtk-4.1 base-devel libappindicator-gtk3 librsvg libxtst xdotool" >&2
        exit 1
      fi
    else
      echo "pkg-config not found; skipping the library check (install pkg-config if the build fails)." >&2
    fi
    ;;
esac
