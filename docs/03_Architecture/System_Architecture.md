# System Architecture

```
┌───────────────────────── Tauri 2 app (pocketpet, Rust) ─────────────────────────────┐
│ lib.rs       commands · tray · overlay config · cursor thread · hotkey dispatch      │
│ geom.rs      Rect / WindowInfo / CaptionButtons shared by every platform             │
│ paths.rs     per-OS data folder                                                      │
│ ── Windows (#[cfg(windows)]) ──                                                      │
│ win.rs       Win32: windows, foreground, fullscreen, battery, pid→hwnd, syscommand  │
│ titlebar.rs  caption-button geometry (TITLEBARINFOEX → UIA → guess)                  │
│ startup.rs   HKCU Run key · RegisterHotKey thread with rebinding                     │
│ extras.rs    monitors · file dialogs · clipboard · GitHub update feed                │
│ ── macOS / Linux (#[cfg(not(windows))]) ──                                           │
│ unix.rs      same four modules' API: Tauri monitors, device_query cursor, rfd        │
│              dialogs, arboard clipboard, auto-launch, global-shortcut plugin,        │
│              keyring; window list / caption buttons return empty                    │
│ agent.rs     task loop (Anthropic + OpenAI wires, SSE) · tools · gates · memory      │
│              audit · spend · digest · follow-ups · transcription                     │
│ browser.rs   CDP client: launch, attach, page view, input, tabs, screenshots         │
├──────────────── webview windows (WebView2 · WKWebView · WebKitGTK; same origin) ─────┤
│ overlay  index.html + main.js   pet, games, breaks, focus, narration, schedules      │
│ settings settings.html/.js      preferences, dashboard, backup, updates              │
│ tasks    tasks.html/.js         task input, approvals, answer, timed progress, keys  │
│ shared   preferences.js (schema) · behavior.js (rules) · games.js · pets/*.js        │
└──────────────────────────────────────────────────────────────────────────────────────┘
      │ invoke / emit (IPC)          │ HTTPS (reqwest, rustls)         │ WebSocket (CDP)
      ▼                              ▼                                  ▼
 OS APIs                       LLM providers                     Chromium (own profile)
 keychain, UIA (Win), autostart, Anthropic Messages /            <data dir>/browser
 notifications                 OpenAI-compatible
```

## Process model

- One process. Rust owns threads: cursor sampler (16 ms), hotkey message loop,
  Tauri async runtime (tasks, HTTP, CDP), a short-lived thread for delayed hide.
- Three webview windows share one origin (`http://tauri.localhost`; `tauri://localhost` on macOS/Linux) and thus
  one `localStorage`; the overlay is the only writer of history/spend to avoid
  cross-process races.
- The agent's browser is a separate Chromium process tree, launched with
  `--remote-debugging-port` and a dedicated `--user-data-dir`.

## Data flow (agent)

Task text → `agent_run` → `Ctx` (cancel/pause flags, spend, loop guard) →
provider turn (SSE) → tool dispatch → gates → browser/CDP or HTTP → tool result
(digested) → next turn → answer → events to windows + audit log.

## Key design decisions

| Decision | Why |
|----------|-----|
| Plain ES modules, no bundler | zero build step for the frontend; CSP-friendly |
| All model traffic in Rust | keys never reach JS; CSP stays `'self'` |
| Two wire formats only | every provider the user asked for is Anthropic or OpenAI-compatible |
| Gates in code, not prompts | prompts can be talked around; regexes cannot |
| Single-writer localStorage | WebView2 propagates writes between processes with delay |
| `#[cfg]` split, not a trait | Two implementations of one module API (`win`/`titlebar`/`startup`/`extras` vs `unix.rs`) keep the Windows path untouched and let non-Windows return empty for window tricks |
| Own browser profile | user's sessions stay untouched; agent sessions persist for "sign in once" |
| Streaming with fallback | local servers sometimes reject `stream_options` |
