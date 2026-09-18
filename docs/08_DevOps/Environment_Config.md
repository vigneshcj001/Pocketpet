# Environment Configuration

## Build machine
- Windows 10/11 x64, Rust stable (rustup), MSVC Build Tools (Desktop C++), Windows SDK 10.0.26100, Node 22, `tauri-cli ^2`.
- `run.ps1` finds cargo even in stale terminals (honours `CARGO_HOME`/`RUSTUP_HOME` user env) and loads `vcvars64`.
- Disk: keep ≥ 15 GB free; `target/debug` grows past 10 GB — prune with `cargo clean` or delete `target/debug`.

## Runtime config (no env vars required)
| Setting | Where |
|---------|-------|
| Provider keys | Credential Manager `PocketPet/<provider>` |
| Provider base URLs | Tasks › Providers & keys |
| Limits, sites, rules | Tasks › Limits & sites |
| Everything else | Settings window |

## Debugging
- `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222"` before launching exposes CDP for the app's own windows; `tests/agent-eval.mjs` and the scratch CDP scripts use it.
- Debug overlay hook: `window.__pet` (state, settings, games, say, startPlacing, mission, startBreak, updateFocus, reloadSettings).
