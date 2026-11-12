# Environment Configuration

## Build machine
- **Windows:** Windows 10/11 x64, Rust 1.90+ (rustup), MSVC Build Tools (Desktop C++), Windows SDK 10.0.26100, Node 20+ (tests only), `tauri-cli ^2`.
- **macOS:** Xcode command-line tools, Rust stable with `aarch64-apple-darwin` and/or `x86_64-apple-darwin`, `tauri-cli ^2`.
- **Linux (Debian/Ubuntu):** `libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf libx11-dev libxtst-dev libdbus-1-dev libgtk-3-dev`, Rust stable, `tauri-cli ^2`.
- **Linux (Fedora):** `webkit2gtk4.1-devel openssl-devel libappindicator-gtk3-devel librsvg2-devel libX11-devel libXtst-devel dbus-devel libxdo-devel`.
- **Linux (Arch):** `webkit2gtk-4.1 base-devel libappindicator-gtk3 librsvg libxtst xdotool`.
- `run.sh` / `build.sh` check these with `pkg-config` and print the install line for the distro.
- Tauri does not cross-compile; each package is built on its own OS (CI does this).
- `run.ps1` finds cargo even in stale terminals (honours `CARGO_HOME`/`RUSTUP_HOME` user env) and loads `vcvars64`.
- Disk: keep ≥ 15 GB free; `target/debug` grows past 10 GB — prune with `cargo clean` or delete `target/debug`.

## Runtime environment variables (all optional)

| Variable | OS | Effect |
|---|---|---|
| `POCKETPET_BROWSER` | all | Full path of the Chromium-family browser the agent drives |
| `POCKETPET_NATIVE_WAYLAND` | Linux | Stay on native Wayland instead of XWayland |
| `GDK_BACKEND` | Linux | If set, PocketPet does not override it |
| `WEBKIT_DISABLE_DMABUF_RENDERER` | Linux | If set, PocketPet does not override it (default it sets: `1`) |
| `XDG_DATA_HOME` | Linux | Data folder becomes `$XDG_DATA_HOME/PocketPet` |

## Runtime config (in the app)
| Setting | Where |
|---------|-------|
| Provider keys | OS keychain `PocketPet/<provider>` (Credential Manager · Keychain · Secret Service / `0600` file) |
| Provider base URLs | Tasks › Providers & keys |
| Limits, sites, rules | Tasks › Limits & sites |
| Everything else | Settings window |

## Debugging
- Windows: `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222"` before launching exposes CDP for the app's own windows; macOS: Safari → Develop → the app's webviews; Linux: `WEBKIT_INSPECTOR_SERVER=127.0.0.1:9222`. `tests/agent-eval.mjs` and the scratch CDP scripts use it.
- Debug overlay hook: `window.__pet` (state, settings, games, say, startPlacing, mission, startBreak, updateFocus, reloadSettings).
