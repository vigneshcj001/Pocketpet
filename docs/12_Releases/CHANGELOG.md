# Changelog

## 0.1.0 (unreleased tag; installer built 2026-09-19)

### 2026-09-19 (later)
- **Hide & seek**: the fullness bar is now removed (`display:none`) for the whole game and the covered pet gets an inline `visibility:hidden` on top of the CSS class, so nothing can peek out from under a closed box.
- **Settings window**: resizable (min 380×480, default 440×680); tabs wrap instead of scrolling sideways; the title is gone and a search box filters cards across every tab (`Ctrl+F`); fields sit label-left / control-right with slider values inline; each plain-settings card has a hover "Reset"; dependent fields (quiet hours, snooze/countdown/toasts, break length, volume, keep-out box) fade while their switch is off; shortcut fields have an × unbind button and flag two actions on one combination; the Pets tab shows a live sprite preview (colour, accessories, personality). Tint helpers moved to `appearance.js`, shared with the overlay.
- **Tasks window**: provider list shows 🔑 / ⚠ no-key per provider; the approval card is sticky under the header and counts how long it has waited; log and answer heights scale with the window; examples reopen when idle with an empty box; History has a search box, a count, and "▶ Run again" / "↩ Follow up" (newest task only) per row; API keys get a show/hide eye and a "Test" that lists the provider's models with the saved key; key rows and long-placeholder fields laid out properly.

### 2026-09-19
- **Hide & seek fix**: the hunger bar (and countdown pill) poked out under the box and gave the pet away. Both are hidden during games, the pet is centred inside its box, and it is fully hidden (`pet-game-covered`) from the moment the lid closes until the reveal.
- **Tasks window**: Task tab reordered — compose → approval → answer → progress → examples; approval and answer cards scroll into view (Allow gets focus). Plan merged into the progress card with a state chip (Idle / Working / Needs approval / Paused / Done / Failed), live elapsed timer and per-line `m:ss` timestamps. Log only auto-follows when scrolled to the bottom; screenshot collapses under "Latest screenshot"; examples collapse after the first run; task box auto-grows; `Ctrl+Enter` hint; "↩ Follow up" button on the answer; missing-key hint in red.
- **Fixed**: `.pair { display:flex }` overrode `hidden`, so the free-text reply row showed on approval cards.

### Pet
- Cursor following, ledge walking, caption-button pressing, drag/throw, perch, double-click to sit on the active window.
- Feeding, three toys with fetch, obstacle-jump and hide-and-seek games, petting, stats, milestones, journal.
- Companion pet, custom image pets (≤ 12), colour picker recolouring body fills, free-form emoji accessories in slots, personalities, names.
- Break reminders (snooze, countdown, cycles), focus mode, quiet hours, toasts, low-power mode, multi-monitor bounds, keep-out area.
- Tray, rebindable hotkeys, run at startup, sounds, settings window with dashboard, backup/restore.

### Task agent
- Providers: Claude, OpenAI, Groq, Gemini, DeepSeek, Ollama, custom; keys in Credential Manager.
- Web search/fetch; browser driving over CDP with numbered page view; plans; streaming; follow-ups; digest model.
- Gates: sensitive clicks/URLs, secret fields, allow-list, per-site rules, purchase cap, spend cap, loop guard, kill switch.
- Memory, schedules, task queue, voice (Windows speech / Whisper), read-aloud, audit logs, sign-in-once, pause/take-over.

### Platform
- NSIS installer, update check against GitHub Releases, crash logs, diagnostics, window-state persistence, CI workflow, eval script.

### Fixed along the way
- CSP blocked IPC; `virtual` field mismatch froze the loop; foreground lookup saw the overlay itself; sync `open_settings` deadlock; cross-window localStorage race; Gemini retired model / array errors / `thought_signature`; NUL bytes in `extras.rs`.
