# Technical Design

Version 0.1 · September 2026

## 1. Platform

| Item | Requirement |
|------|-------------|
| OS | Windows 10 21H2+ / Windows 11, x64 |
| Runtime | WebView2 (preinstalled on Win11; Evergreen installer otherwise) |
| Browser for the agent | Edge, Chrome or Brave (Chromium with `--remote-debugging-port`) |
| Framework | Tauri 2 (Rust 1.77+, `windows` crate 0.58), plain ES-module frontend, no bundler |
| Build | `cargo tauri build` → NSIS per-user installer `PocketPet_<ver>_x64-setup.exe` |
| Install location | `%LOCALAPPDATA%\PocketPet\pocketpet.exe`; data in `%LOCALAPPDATA%\PocketPet\` |

## 2. Architecture

```
┌───────────────────────── Tauri app (pocketpet.exe) ─────────────────────────┐
│  Rust                                                                        │
│  lib.rs        commands, tray, overlay window, cursor thread, hotkeys        │
│  win.rs        Win32: windows list, foreground, fullscreen, battery, pid→hwnd│
│  titlebar.rs   caption-button geometry (TITLEBARINFOEX, UIA, guess)          │
│  startup.rs    Run key, RegisterHotKey thread, rebinding                     │
│  extras.rs     monitors, file dialogs, clipboard, GitHub update check        │
│  agent.rs      task loop (Anthropic + OpenAI wires, SSE), tools, gates,      │
│                memory, audit, spend, digest, follow-ups, transcription       │
│  browser.rs    CDP client: launch, attach, read_page, click/type/…, tabs     │
│                                                                              │
│  WebView2 windows (same origin, shared localStorage)                         │
│  overlay   index.html + main.js      the pet, games, breaks, narration       │
│  settings  settings.html/.js         all preferences, dashboard, backup      │
│  tasks     tasks.html/.js            task input, progress, approvals, keys   │
│  shared    preferences.js (schema+validation), behavior.js, games.js         │
└──────────────────────────────────────────────────────────────────────────────┘
        │ IPC (invoke / events)                 │ HTTPS               │ CDP ws
        ▼                                       ▼                     ▼
  Windows APIs                          LLM providers          Chromium (own profile)
  Credential Manager, registry,         Anthropic Messages     %LOCALAPPDATA%\PocketPet\browser
  UIA, notifications                    OpenAI-compatible
```

## 3. Functional requirements

### 3.1 Overlay (pet)

- FR-O1 Overlay spans the virtual screen, `WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW`, transparent, click-through except over hit regions reported by the frontend at 60 Hz.
- FR-O2 Cursor position emitted from a Rust thread (`pet://cursor`) at ~60 Hz; frontend never polls.
- FR-O3 Pet physics: gravity, ledges = top edges of visible non-minimised windows (DWM extended frame bounds), monitor-aware floor, roaming bounds, keep-out rect.
- FR-O4 Missions press real caption buttons via `WM_SYSCOMMAND` (default) or real mouse (opt-in).
- FR-O5 Focus mode: fullscreen detection distinguishes borderless fullscreen from maximised (work-area check); quiet hours in local time.
- FR-O6 Low-power: 15 fps timer loop when hidden/asleep/enabled; window scan interval relaxed.
- FR-O7 All persisted state goes through `preferences.js` (`normalizeSettings`) — never raw localStorage writes elsewhere.

### 3.2 Task agent

- FR-A1 Providers: claude (Anthropic Messages), openai, groq, gemini, deepseek, ollama, custom (OpenAI Chat Completions). Base URL overridable per provider.
- FR-A2 Keys stored via `CredWriteW` under `PocketPet/<provider>`; read on demand; never serialised.
- FR-A3 Loop: max N turns (4–60); SSE streaming with one non-streaming retry; `pause_turn` (Anthropic) handled; usage → cost estimate per turn.
- FR-A4 Tools (client-side): `web_search` (DuckDuckGo HTML), `fetch_page`, `open_browser`, `read_page`, `click`, `type_text`, `select_option`, `press_key`, `scroll`, `screenshot`, `wait`, `close_browser`, `ask_user`, `remember`, `set_plan`, `update_step`. Claude additionally gets Anthropic server tools `web_search_20260209` / `web_fetch_20260209`.
- FR-A5 Gates (code, not prompt): sensitive click text/href regex, sensitive URL regex, secret-field detection, allow-list, per-site rules, purchase cap (page-total regex), spend cap, loop guard (3 identical calls), 15-minute answer timeout.
- FR-A6 Events (`pet://task`): start, tool, result, note, delta, plan, step, shot, act, browser, confirm, ask, usage, answer, error, cancelled, killed. Every non-chatty event is appended to `tasks/<id>.log`.
- FR-A7 Follow-up: last conversation (≤ 40 messages) kept in memory per wire; `continue_previous` prepends it.
- FR-A8 Digest: tool outputs > 7 000 chars condensed by `digest_model` (same provider) when set.
- FR-A9 Browser driver: per-app Chromium profile; free port; attach to first page target; real `Input.dispatch*` events; `read_page` = numbered interactive elements (≤ 160) + text (≤ 7 000 chars); new-tab following; JPEG screenshots q55.
- FR-A10 Voice: Windows `SpeechRecognizer` (offline) or Whisper via Groq/OpenAI multipart upload; TTS via `speechSynthesis` with per-pet pitch/rate.
- FR-A11 Schedules evaluated every 30 s in the overlay; one run per schedule per day, 10-minute window, skipped while a task runs.

### 3.3 Settings & data

- FR-S1 Schema versioned by `normalizeSettings`; unknown/invalid values coerced; migrations for legacy fields (`customImage`, hue colours, named accessories).
- FR-S2 Cross-window writes are patches merged onto a fresh read; the overlay is the only writer of task history and spend.
- FR-S3 Backup = `{ app: "PocketPet", version: 1, settings }` JSON; import validated by `parseBackup`; keys excluded by construction.
- FR-S4 Memory: `memory.md` ≤ 6 000 chars, appended by the `remember` tool, editable in the Tasks window.

## 4. Non-functional requirements

| Area | Requirement |
|------|-------------|
| Performance | Overlay ≤ 3 % CPU idle at 60 fps on an integrated GPU; ≤ 1 % in low-power. Hit-region IPC only on change. |
| Latency | First streamed token < 2 s on hosted providers; `read_page` < 400 ms on typical pages. |
| Cost | Typical research task < $0.05; browser task < $0.30 (with digest model); enforced by daily cap. |
| Reliability | Panics logged to `logs/panic-<ts>.log`; agent errors surfaced verbatim in the Tasks window and log. |
| Security | Keys never in JS, settings, backups or logs. Webview CSP: `default-src 'self'; connect-src ipc: http://ipc.localhost`. All provider traffic from Rust. Downloads for updates only from github.com / objects.githubusercontent.com. |
| Privacy | No telemetry. Diagnostics text lists provider names with keys, never keys. |
| Accessibility | Menus keyboard-navigable; speech size/duration adjustable; read-aloud. |
| Maintainability | Pure logic in `preferences.js`, `behavior.js`, `games.js` with Node tests; Rust unit tests for gates, parsing, versioning. |

## 5. Interfaces

### 5.1 Tauri commands (JS → Rust)

Overlay/pet: `get_screen`, `set_hit_regions`, `set_interactive`, `set_capture_all`, `list_windows`, `get_foreground_window`, `get_caption_buttons`, `press_caption_button`, `get_environment`, `set_hidden`, `set_focus_hidden`, `set_low_power`, `sync_tray`, `set_hotkeys`, `get_autostart`, `set_autostart`, `notify`, `pick_image`, `save_backup`, `load_backup`, `open_settings`, `open_tasks`, `open_external`, `window_for_pid`, `quit_app`.

Agent: `agent_providers`, `agent_set_key`, `agent_delete_key`, `agent_models`, `agent_run`, `agent_cancel`, `agent_pause`, `agent_reply`, `agent_kill`, `agent_close_browser`, `agent_open_site`, `agent_transcribe`, `windows_listen`, `memory_read`, `memory_write`, `open_task_log`, `open_logs_folder`, `diagnostics`, `check_update`, `install_update`.

### 5.2 Events (Rust → JS)

`pet://cursor`, `pet://menu`, `pet://settings` (JS→JS broadcast), `pet://task`, `pet://voice`, `pet://clip`.

### 5.3 `agent_run` request

```json
{ "id": "…", "task": "…", "provider": "gemini", "model": "gemini-3.6-flash",
  "baseUrl": "", "petName": "Mochi", "maxTurns": 24,
  "allowedSites": ["amazon.in"], "siteRules": { "amazon.in": "allow" },
  "budgetUsd": 1.5, "purchaseCap": 2000, "browser": true,
  "digestModel": "gemini-3.5-flash-lite", "continuePrevious": false, "stream": true }
```

## 6. Build, test, release

```powershell
.\run.ps1                 # debug run
cargo test --manifest-path src-tauri/Cargo.toml --lib
node --test tests/features.test.mjs
node tests/agent-eval.mjs gemini gemini-3.6-flash   # live, costs money
.\build-installer.ps1     # NSIS installer
```

CI (`.github/workflows/build.yml`): tests + installer on every push; tag `v*`
publishes a GitHub Release with the installer, which the in-app update check
reads (`/repos/vigneshcj001/Pocketpet/releases/latest`).

## 7. Constraints & known limits

- Windows-only APIs throughout (`windows` crate); no cross-platform abstraction.
- DuckDuckGo HTML endpoint is unofficial; may throttle. Claude uses Anthropic's tools instead.
- Windows speech needs "Online speech recognition" enabled; otherwise Whisper needs a key.
- Gemini's OpenAI endpoint requires `thought_signature` echo on tool calls (handled), and retires models often (default tracked).
- Purchase-cap total detection is regex-based; currency-agnostic number.
