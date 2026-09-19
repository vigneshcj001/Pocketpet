# Environment Configuration

## Build machine
- **Windows:** Windows 10/11 x64, Rust stable (rustup), MSVC Build Tools (Desktop C++), Windows SDK 10.0.26100, Node 22, `tauri-cli ^2`.
- **macOS:** Xcode command-line tools, Rust stable with `aarch64-apple-darwin` and/or `x86_64-apple-darwin`, `tauri-cli ^2`.
- **Linux (Debian/Ubuntu):** `libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf libx11-dev libxtst-dev libdbus-1-dev libgtk-3-dev`, Rust stable, `tauri-cli ^2`.
- Tauri does not cross-compile; each package is built on its own OS (CI does this).
- `run.ps1` finds cargo even in stale terminals (honours `CARGO_HOME`/`RUSTUP_HOME` user env) and loads `vcvars64`.
- Disk: keep ≥ 15 GB free; `target/debug` grows past 10 GB — prune with `cargo clean` or delete `target/debug`.

## Runtime config (no env vars required)
| Setting | Where |
|---------|-------|
| Provider keys | OS keychain `PocketPet/<provider>` (Credential Manager · Keychain · Secret Service / `0600` file) |
| Provider base URLs | Tasks › Providers & keys |
| Limits, sites, rules | Tasks › Limits & sites |
| Everything else | Settings window |

## Debugging
- Windows: `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222"` before launching exposes CDP for the app's own windows; macOS: Safari → Develop → the app's webviews; Linux: `WEBKIT_INSPECTOR_SERVER=127.0.0.1:9222`. `tests/agent-eval.mjs` and the scratch CDP scripts use it.
- Debug overlay hook: `window.__pet` (state, settings, games, say, startPlacing, mission, startBreak, updateFocus, reloadSettings).
