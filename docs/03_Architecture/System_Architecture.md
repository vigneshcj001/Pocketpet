# System Architecture

```
┌───────────────────────── Tauri 2 app (pocketpet.exe, Rust) ─────────────────────────┐
│ lib.rs       commands · tray · overlay config · cursor thread · hotkey dispatch      │
│ win.rs       Win32: windows, foreground, fullscreen, battery, pid→hwnd, syscommand  │
│ titlebar.rs  caption-button geometry (TITLEBARINFOEX → UIA → guess)                  │
│ startup.rs   HKCU Run key · RegisterHotKey thread with rebinding                     │
│ extras.rs    monitors · file dialogs · clipboard · GitHub update feed                │
│ agent.rs     task loop (Anthropic + OpenAI wires, SSE) · tools · gates · memory      │
│              audit · spend · digest · follow-ups · transcription                     │
│ browser.rs   CDP client: launch, attach, page view, input, tabs, screenshots         │
├───────────────────────── WebView2 windows (same origin) ─────────────────────────────┤
│ overlay  index.html + main.js   pet, games, breaks, focus, narration, schedules      │
│ settings settings.html/.js      preferences, dashboard, backup, updates              │
│ tasks    tasks.html/.js         task input, progress, approvals, keys, limits        │
│ shared   preferences.js (schema) · behavior.js (rules) · games.js · pets/*.js        │
└──────────────────────────────────────────────────────────────────────────────────────┘
      │ invoke / emit (IPC)          │ HTTPS (reqwest, rustls)         │ WebSocket (CDP)
      ▼                              ▼                                  ▼
 Windows APIs                  LLM providers                     Chromium (own profile)
 Credential Manager, UIA,      Anthropic Messages /              %LOCALAPPDATA%\PocketPet\browser
 registry, notifications       OpenAI-compatible
```

## Process model

- One process. Rust owns threads: cursor sampler (16 ms), hotkey message loop,
  Tauri async runtime (tasks, HTTP, CDP), a short-lived thread for delayed hide.
- Three WebView2 windows share one origin (`http://tauri.localhost`) and thus
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
| Own browser profile | user's sessions stay untouched; agent sessions persist for "sign in once" |
| Streaming with fallback | local servers sometimes reject `stream_options` |
