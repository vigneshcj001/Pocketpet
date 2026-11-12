# Changelog

## 0.2.4 (cross-platform hardening)

### Linux
- **No more crash on Wayland-only sessions.** The cursor poller used `DeviceState::new()`, which panics without an X display; with `panic = "abort"` that killed the whole app. It now uses `checked_new()` and keeps running (cursor-following and click-through off, logged once).
- **XWayland by default on Wayland desktops.** When `DISPLAY` is available and `GDK_BACKEND` is unset, PocketPet starts on the X11 backend so cursor-following and click-through work on GNOME/KDE Wayland. Opt out with `POCKETPET_NATIVE_WAYLAND=1`.
- **Blank/black overlay fix.** `WEBKIT_DISABLE_DMABUF_RENDERER=1` is set unless the user already chose a value (NVIDIA and several compositors drew the transparent overlay as an opaque box).
- **AppImage no longer leaks its libraries into your browser.** The agent's Chrome/Edge/Brave and `xdg-open` are launched with every `$APPDIR` entry stripped from `LD_LIBRARY_PATH`, `GST_PLUGIN_*`, `XDG_DATA_DIRS`, `PATH`, and similar variables, and without the two variables above.
- **`pocketpet://` links work from an AppImage**: the scheme is registered at runtime (the .deb/.rpm register it through their desktop file).
- **New `.rpm` package** (Fedora, openSUSE) built by CI and offered on the website.
- **Updates match the install type**: a .deb/.rpm install is offered the .deb/.rpm (opened in the software installer); only AppImage installs get the AppImage.
- `xdg-open` children are reaped instead of left as zombies; a missing tray (GNOME without AppIndicator) can no longer abort start-up.

### macOS / Linux / Windows
- Browser discovery: `POCKETPET_BROWSER=/path/to/browser` override everywhere; also finds per-user Brave, Chromium and Vivaldi on Windows, Vivaldi on macOS, and Brave/Chromium/Edge Flatpaks (system and per-user) and Vivaldi on Linux.
- Agent key presses accept `Cmd` / `Command` / `Super` as the meta modifier.
- Settings and Tasks wording follows the OS: API keys say Keychain / Secret Service instead of "Windows Credential Manager"; the voice hint and the "Win means ⌘ / Super" shortcut note are per platform; "Windows notification" is now "Desktop notification"; per-app pet modes are greyed out off Windows (they need the foreground executable).
- `bundle.targets` lists every platform's packages (`nsis`, `app`, `dmg`, `deb`, `rpm`, `appimage`); Tauri builds the ones that apply, so a plain `cargo tauri build` works on macOS and Linux too.

### Developer experience
- `run.sh` / `build.sh` (+ `scripts/check-deps.sh`) for macOS and Linux, matching `run.ps1` / `build-installer.ps1`. The dependency check prints the apt / dnf / pacman line for anything missing.
- `package.json` (no dependencies) marks the frontend as ES modules, so the tests run on Node 20 as well as 22, and adds `npm test` / `npm run check`.
- `scripts/run-tests.mjs` replaces the shell glob `tests/*.test.mjs`, which PowerShell and cmd do not expand. CI uses it.
- New `tests/platform.test.mjs`; Rust tests for `paths.rs`.

## 0.2.2 – 0.2.3 (local changes; not published)

- Settings now shows installed build identity beside latest published release and explains tagged-release requirement.
- Windows foreground-app rules switch pet between playful, quiet, and hidden modes. Fullscreen focus remains higher priority.
- Saved task recipes can run immediately or fill a schedule. Finished tasks now persist in History with result cards, answer links, mentioned prices/dates, approval counts, and audit-log access.
- Friendship level and mood respond to interaction count and hunger. Companion pets greet each other when nearby.
- Custom pets accept four-frame horizontal sprite sheets for idle, walk, sleep, and happy states.
- Website can send appearance through a `pocketpet://` app link; JSON import remains available. Credentials and trust rules stay local.
- Website demo hides companion controls behind its launcher.

## 0.1.0 (unreleased tag; installer built 2026-09-19)

### 2026-09-19 (website)
- **Download page** at <https://pocketpet-web.vercel.app/> ([Pocketpet-web](https://github.com/vigneshcj001/Pocketpet-web)): live pet demo with the app's sprites, per-OS download cards wired to GitHub Releases, feature matrix, agent demo, changelog from releases. README and DevOps docs link to it.

### 2026-09-19 (macOS / Linux)
- **Cross-platform build.** Win32 code (`win`, `titlebar`, `startup`, `extras`, Credential Manager, Windows speech) is `#[cfg(windows)]`; `unix.rs` supplies the same API for macOS/Linux: Tauri monitors for screen layout, `device_query` cursor poller (points→pixels on macOS), `rfd` dialogs, `arboard` clipboard, `auto-launch` startup, `tauri-plugin-global-shortcut` hotkeys, `keyring` (Keychain / Secret Service) with a `0600` file fallback. Window enumeration and caption buttons return empty there, and the frontend greys out mischief / real clicks. Shared `geom.rs`, `paths.rs`, `actions.rs`. Overlay: `macOSPrivateApi`, Accessory activation policy, visible on all workspaces. Update check picks the `.dmg` / `.AppImage` asset per platform.
- **CI** builds Windows NSIS, macOS aarch64 + x64 DMG, Linux AppImage + deb; tags publish all of them.

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
