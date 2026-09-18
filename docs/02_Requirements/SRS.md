# Software Requirements Specification

Version 0.1. Functional requirements are numbered FR-*; non-functional live in `NFR.md`.

## 1. Overlay and pet

- FR-O1 The overlay window spans the virtual screen, is transparent, non-activating, tool-window, and click-through except over reported hit regions (pet, bubble, menu, companion, game controls).
- FR-O2 A Rust thread samples the cursor at ~60 Hz and emits `pet://cursor`; it flips click-through based on hit regions and a `capture_all` flag.
- FR-O3 The pet obeys gravity; surfaces are the top edges of visible, non-minimised, non-cloaked windows (DWM extended frame bounds) and the floor of the pet's monitor, clipped to roaming bounds and a keep-out rectangle.
- FR-O4 The pet can press a window's minimise/close button: geometry from `WM_GETTITLEBARINFOEX`, UI Automation, or a guess; action via `WM_SYSCOMMAND` (default) or real mouse (opt-in). Close always requires a confirming click on the pet.
- FR-O5 Speech bubbles with typewriter effect; size and duration configurable.
- FR-O6 Hunger rises in real time (rate configurable, optional pause while closed); feeding via click-to-place; two mini-games; fetch with three toys; petting by hover; pats by click.
- FR-O7 Per-pet profile: counters (meals, pats, pets, fetches, games, wins, breaks, tasks), journal (≤ 40), milestones; accessories are free-form emoji in slots; colour recolours SVG body fills.
- FR-O8 Break reminders: any interval, snooze, countdown pill, optional timed break cycles, toast when hidden/quiet.
- FR-O9 Focus mode: fullscreen foreground app (borderless full-monitor, not maximised work-area) or quiet hours → quiet or hide, self-restoring.
- FR-O10 Low-power: 15 fps timer loop when hidden/asleep/enabled.
- FR-O11 Tray menu mirrors core actions; radio groups synced from the frontend.
- FR-O12 Global hotkeys, rebindable: hide/show, feed, toy, settings, tasks, voice, clipboard task, kill switch.

## 2. Task agent

- FR-A1 Providers: claude (Anthropic Messages), openai, groq, gemini, deepseek, ollama, custom (OpenAI Chat Completions); per-provider base URL override; model list fetched from the provider.
- FR-A2 API keys stored in Windows Credential Manager (`PocketPet/<provider>`); never persisted elsewhere; presence (not value) reported to the UI.
- FR-A3 Loop bounded by `max_turns`; SSE streaming with a non-streaming retry; `pause_turn` handled; usage → USD estimate; daily/task budget enforced.
- FR-A4 Tools as listed in `04_Agents/Tool_Registry.md`; Claude additionally uses Anthropic server web tools.
- FR-A5 Gates as listed in `05_AI/Guardrails.md`, enforced in Rust.
- FR-A6 Events streamed to windows (`pet://task`) and appended to a per-task audit log.
- FR-A7 Follow-up continues the last conversation (same wire, ≤ 40 messages).
- FR-A8 Optional digest model condenses tool outputs > 7 000 chars.
- FR-A9 Browser driver: own Chromium profile, CDP, numbered-element page view, real input events, new-tab following, screenshots.
- FR-A10 Voice input via Windows `SpeechRecognizer` or Whisper (Groq/OpenAI); read-aloud via `speechSynthesis` with per-pet voice.
- FR-A11 Schedules: daily/weekdays/weekends at HH:MM, once per day, only when idle.
- FR-A12 Memory: `memory.md` (≤ 6 000 chars), appended by the `remember` tool, editable.
- FR-A13 Pause/resume, cancel, kill switch (all tasks + browser).

## 3. Settings and data

- FR-S1 Single validated schema (`preferences.js::normalizeSettings`); every write is a patch merged onto a fresh read.
- FR-S2 The overlay is the sole writer of task history and spend.
- FR-S3 Backup export/import (`{app, version, settings}`), keys excluded; reset.
- FR-S4 Settings window: General, Pets, Focus & screen, Breaks, Controls, Dashboard, Backup. Tasks window: Task, History, Schedules, Memory, Providers & keys, Limits & sites.

## 4. Distribution

- FR-D1 NSIS per-user installer; run at startup via HKCU Run.
- FR-D2 Update check against GitHub Releases; download from GitHub hosts only; installer launched and app exits.
- FR-D3 Crash logs written by a panic hook; logs folder and diagnostics text reachable from Settings.
