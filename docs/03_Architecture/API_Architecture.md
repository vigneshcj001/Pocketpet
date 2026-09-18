# API Architecture

PocketPet exposes no network API. Its interfaces are Tauri IPC (in-process),
outbound HTTPS to model providers, and the Chrome DevTools Protocol to its own
browser.

## 1. Tauri commands (JS → Rust)

| Group | Commands |
|-------|----------|
| Screen/pet | get_screen, set_hit_regions, set_interactive, set_capture_all, list_windows, get_foreground_window, get_caption_buttons, press_caption_button, get_environment, window_for_pid |
| Windows/state | set_hidden, set_focus_hidden, set_low_power, sync_tray, set_hotkeys, get_autostart, set_autostart, notify, open_settings, open_tasks, open_external, quit_app |
| Files | pick_image, save_backup, load_backup, memory_read, memory_write, open_task_log, open_logs_folder, diagnostics |
| Agent | agent_providers, agent_set_key, agent_delete_key, agent_models, agent_run, agent_cancel, agent_pause, agent_reply, agent_kill, agent_close_browser, agent_open_site, agent_transcribe, windows_listen |
| Updates | check_update, install_update |

Conventions: top-level args are camelCase in JS and snake_case in Rust
(Tauri converts); nested structs use `#[serde(rename_all = "camelCase")]`.
Long-running or dialog-showing commands are `async` (a sync command that
creates a window deadlocks on Windows).

## 2. Events

| Event | Direction | Payload |
|-------|-----------|---------|
| pet://cursor | Rust→overlay | {x, y} physical px, ~60 Hz |
| pet://menu | Rust→overlay | {id, value?} tray/hotkey actions |
| pet://task | Rust→all windows | {id, kind, text, detail?} |
| pet://voice, pet://clip | Rust→tasks | {} / {text} |
| pet://settings | JS→JS | patch that changed |

## 3. Provider APIs (outbound)

| Wire | Request | Streaming | Auth |
|------|---------|-----------|------|
| Anthropic Messages | `POST /v1/messages` {model, system, messages, tools, thinking:{type:"adaptive"}, output_config:{effort}} | `stream:true`, SSE events | `x-api-key`, `anthropic-version: 2023-06-01` |
| OpenAI Chat Completions | `POST /chat/completions` {model, messages, tools, tool_choice:"auto"} | `stream:true`, `stream_options.include_usage` | `Authorization: Bearer` |
| Models | `GET /v1/models` (Anthropic) · `GET /models` · Ollama `GET /api/tags` | — | same |
| Whisper | `POST /audio/transcriptions` multipart | — | Bearer |
| GitHub | `GET /repos/vigneshcj001/Pocketpet/releases/latest` | — | none |
| DuckDuckGo | `GET https://html.duckduckgo.com/html/?q=` | — | none |

## 4. CDP (to the agent's browser)

Browser-level: `Target.getTargets`, `Target.createTarget`, `Target.attachToTarget` (flatten).
Session-level: `Page.enable/navigate/bringToFront/captureScreenshot`,
`Runtime.enable/evaluate`, `Input.dispatchMouseEvent/dispatchKeyEvent/insertText`,
`Browser.close`. Events are not subscribed; readiness is polled via `document.readyState`.
