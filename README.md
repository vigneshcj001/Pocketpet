# PocketPet

A desktop pet for Windows (full), macOS and Linux (cursor-following, tasks,
games, errands; no window tricks). Pick a cat, duck, panda, penguin, or custom
pet; an optional companion can join it. The active pet lives in a
transparent overlay that spans every monitor. It chases your cursor, perches on
the titlebars of your real windows, talks to you, and can walk over to a
window's caption buttons and press them with its paw.

Built with Tauri v2 (Rust + the system webview: WebView2 on Windows, WKWebView
on macOS, WebKitGTK on Linux). No Electron and no bundler; `package.json` only
holds test scripts and has no dependencies.

| Platform | Packages | Status |
|---|---|---|
| Windows 10 21H2+ / 11 (x64; ARM via emulation) | `.exe` installer | Full feature set |
| macOS 11+ (Apple Silicon and Intel) | `.dmg` | Everything except window tricks |
| Linux x86-64 (X11, or Wayland with XWayland) | `.deb`, `.rpm`, `.AppImage` | Everything except window tricks |

**Download:** <https://pocketpet-web.vercel.app/> — picks the right package for
your OS. All builds are on the
[Releases](https://github.com/vigneshcj001/Pocketpet/releases/latest) page.

| | |
|---|---|
| App (this repo) | <https://github.com/vigneshcj001/Pocketpet> |
| Website | <https://pocketpet-web.vercel.app/> · source: <https://github.com/vigneshcj001/Pocketpet-web> |

## Companion controls

Cat is the default for new installations. Existing animal and custom pet selections are preserved. Older droplet selections switch to cat, with friendship history carried over. Click the small **⋯** button beside the pet to reveal Chat, Voice, and Details. A badge marks tasks needing attention or results not yet viewed; controls stay closed until clicked. Click the task-status pill to open task details and approvals. Controls move above the pet when there is not enough space below it.

The task window uses the same pet and colour, with starting, thinking and completed expressions. Voice uses the configured desktop voice engine; enable it under Providers & keys. Rebuild and restart the desktop app to use these changes.

## Features

- **Follows the cursor.** Walks when you're near, runs when you're far, settles
  and sits when you stop moving, falls asleep after 25s of stillness.
- **Stands on your windows.** Surfaces come from the live window list, so the
  pet walks along the top edge of Explorer, your editor, your browser — and hops
  up onto a ledge when one appears ahead.
- **Presses real caption buttons.** The pet walks to a window's minimise or
  close button, a ring marks the target, the arm stretches out, and the button
  is actually pressed.
- **Throwable.** Drag it anywhere and let go; it flies with your release
  velocity, falls under gravity, and squashes on landing.
- **Talks.** Typewriter speech bubbles with per-animal dialogue for idling,
  patting, dragging, landing, sleeping and each window action.
- **Two menus.** Right-click the pet for an in-place menu, or use the tray icon.
- **Click-through everywhere except the pet.** Your clicks land on whatever is
  underneath; only the pet body, its bubble and its menu catch input.
- **Feed it.** Pick *Feed*, click anywhere, and it runs over and eats. The
  fullness bar shows when food is needed. Offline hunger is paused by default.
- **Fetch.** Throw a ball, yarn or frisbee where you click; the pet chases it
  down and brings it back to you.
- **Pet it.** Rest the cursor on it for a second: purring and hearts. Click for
  a pat, double-click to send it up onto the window you're working in.
- **A life of its own.** Yawns, stretches, looks around, spins, wanders, peeks
  over window edges when the cursor is still; sleeps sooner late at night and
  greets you by time of day.
- **Break reminder.** Set any interval, then snooze or start a timed break.
  A toast appears instead when the pet is hidden.
- **Companion.** A second animal that can be fed, patted and played with.
- **Your own picture as a pet.** Add up to 12 PNG, GIF, JPG or WebP pictures;
  each is cropped and resized before saving. Four-frame horizontal sprite
  sheets can show idle, walk, sleep, and happy states.
- **Sounds.** Synthesised chirp, purr, munch and boing — no audio files. Mute
  and volume in settings.
- **Size, speed, run-at-startup and editable global shortcuts,** a settings
  window, and a keyboard-navigable, theme-aware right-click menu.
- **Multi-monitor aware.** Stands on the bottom of *its* screen, not the
  tallest one. Pick a monitor, set an edge margin, keep it to the bottom
  strip, or mark a keep-out area it must never enter.
- **Focus mode.** Hides, or goes quiet (no talking, sounds, nags, wandering),
  when a fullscreen app is in front or during your quiet hours.
- **Breaks, properly.** Any interval, snooze (right-click the pet), a
  countdown pill above it, and optional timed work/break sessions.
- **Make it yours.** Name, a real colour picker that recolours the body
  (eyes, cheeks, beaks stay), personality (playful / calm / sleepy), and up to
  four accessories per pet — most emoji are free, while the bow, star and crown
  unlock through milestones. Place them in hat / face / neck / back / paw
  slots with size and offset. Up to 12 custom-image pets, auto-cropped and
  shrunk.
- **Companion that counts.** Feed, pat and cuddle the second pet too; it has
  its own hunger and history and chases the toy alongside.
- **Toys and games.** Ball, yarn or frisbee for fetch; obstacle-jump and
  hide-and-seek mini-games with a win record (while hiding, the pet and its
  hunger bar vanish completely — no peeking).
- **Dashboard.** Per-pet counters, milestones with progress, a journal, and
  accessories that unlock as you go. Friendship level and mood reflect play and hunger.
- **Per-app pet modes (Windows).** Assign an executable a playful, quiet, or
  hidden mode. Fullscreen protection still takes priority.
- **Pet friendships.** Nearby companions greet each other and share a moment.
- **Shortcuts you choose.** Hide/show, feed, throw and settings hotkeys are
  all rebindable; speech-bubble size and duration are adjustable.
- **Battery-friendly.** Drops to 15 fps and scans windows less when hidden,
  asleep, or in low-power mode.
- **Backup & restore.** Export settings, pets, progress, task history, schedules,
  and waiting tasks to JSON. API keys, saved memory, logs, and browser sign-ins
  stay on this machine.
- **Ask me to do something.** A task agent: type (or speak) an errand and the
  pet runs it — web search, page reading, and a real browser window it drives
  itself (its own profile, separate from yours). It plans in steps, narrates,
  sits on the browser and points at what it clicks, then files the answer.
  Anything that pays, books, logs in, sends or deletes stops for your approval
  in the Tasks window (the card pops in right under the task box, with a live
  state chip, elapsed timer and timestamped progress log below); it never
  types passwords or card numbers. Allowed-site
  list, daily spend cap, pause/take-over, memory of your preferences, voice in
  (Whisper) and read-aloud. Works with Claude (Anthropic web tools), OpenAI,
  Groq, Gemini, DeepSeek, Ollama, or any OpenAI-compatible local server. API
  keys live in the OS keychain: Windows Credential Manager, the macOS
  Keychain, or the Linux Secret Service (with a `0600` file fallback).
- **Agent extras.** Streamed answers, follow-up questions that keep context,
  a cheaper "digest" model for long pages, auto-screenshots when a page has no
  readable text or after repeated errors, new-tab following, purchase cap
  (refuses pay/order clicks over an amount), per-site allow/ask/never rules,
  scheduled tasks, a queue, a kill switch (Ctrl+Alt+X), voice via Windows
  speech or Whisper (Ctrl+Alt+V), task-from-clipboard (Ctrl+Alt+D), per-task
  audit logs, "sign in once" for the pet's browser, update check against
  GitHub Releases, crash logs and a diagnostics copy button. Windows remember
  their size and position.
- **Task recipes and result cards.** Save reusable prompts, run or schedule
  them, then review answer links, prices, dates, approval count, and audit log.
- **Website pet setup handoff.** Dress a pet on the website and send its
  appearance through the installed app's `pocketpet://` link. A JSON download
  can be imported in Settings → Pets if the browser blocks app links. Neither
  route changes credentials or trust rules.

## How the tricky parts work

**Click-through with a hole in it.** Tauri exposes no per-region hit testing
([tauri#2090](https://github.com/tauri-apps/tauri/issues/2090)). So the frontend
reports the pet's bounding boxes to Rust via `set_hit_regions`, and a Rust
thread polls `GetCursorPos` at ~60Hz and flips
`set_ignore_cursor_events(true/false)` as the cursor enters and leaves them.
That thread also feeds cursor position to the frontend, keeping the IPC hot path
off the webview's main thread.

**Finding the caption buttons** — `src-tauri/src/titlebar.rs`, three strategies,
best first:

1. `WM_GETTITLEBARINFOEX` gives exact rects, but only for windows that let the
   system draw their caption (classic Win32 apps, dialogs).
2. **UI Automation** covers custom titlebars — Windows 11 Explorer and Settings,
   Chrome, Edge, VS Code. Buttons are matched by AutomationId first (not
   localised), then by name, and finally by position: the rightmost caption
   button is close, then maximise, then minimise. That last rule is locale-proof.
3. A geometric guess from the window rect. Never exact, but it only aims the
   paw — see below.

Results are cached for 1.5s because the UIA pass can cost tens of milliseconds
on a large app.

**Pressing them.** By default the action is a posted `WM_SYSCOMMAND`
(`SC_CLOSE` / `SC_MINIMIZE`). That cannot mis-click, works even when the rect
was only guessed, and leaves your real cursor where you left it — the paw
animation is the show, the message is the substance. Turn on **Real mouse
clicks** and the pet warps the pointer to the button, clicks with `SendInput`,
and warps it back; that path is skipped entirely when the rect came from the
geometric guess, so a bad guess can never produce a stray click somewhere else.

**Window geometry.** Positions come from
`DwmGetWindowAttribute(DWMWA_EXTENDED_FRAME_BOUNDS)`, not `GetWindowRect` —
the latter includes the invisible resize border Windows 10+ draws around
windows, which would leave the pet floating ~8px off every titlebar. Cloaked
(hidden UWP) windows and tool windows are filtered out.

**The overlay never steals focus.** `WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW` are
OR'd into the window's extended style after creation, so it stays out of
Alt-Tab and the taskbar and never takes activation from what you're typing in.

## Safety choices

- **Closing a window is never automatic.** It always takes two explicit
  actions: pick "Close active window", then click the pet to confirm. Closing
  someone's window can destroy unsaved work.
- **Mischief mode only minimises.** It never closes anything, and it's off by
  default.
- **Real mouse clicks are off by default**, and disabled when button rects were
  guessed rather than measured.

## Install and run

### Just want the app?

Go to <https://pocketpet-web.vercel.app/> and grab the installer for your
platform (Windows `.exe`, macOS `.dmg`, Linux `.deb` / `.rpm` / `.AppImage`).
The rest of this section is for building from source.

### Prerequisites

| OS | Need | Check |
|---|---|---|
| all | Rust 1.90+ from <https://rustup.rs> | `rustc --version` |
| all (optional) | Node 20+ for the JS tests | `node --version` |
| Windows | Visual Studio C++ Build Tools 2022 (MSVC linker) and the Windows 10/11 SDK | `vswhere` / Visual Studio Installer |
| Windows | WebView2 runtime | already present on Win10 21H2+ and Win11 |
| macOS | Xcode command-line tools | `xcode-select -p` |
| Debian / Ubuntu | `sudo apt install libwebkit2gtk-4.1-dev build-essential libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf libx11-dev libxtst-dev libdbus-1-dev` | `pkg-config --exists webkit2gtk-4.1` |
| Fedora | `sudo dnf install webkit2gtk4.1-devel openssl-devel libappindicator-gtk3-devel librsvg2-devel libX11-devel libXtst-devel dbus-devel libxdo-devel` | same |
| Arch | `sudo pacman -S webkit2gtk-4.1 base-devel libappindicator-gtk3 librsvg libxtst xdotool` | same |

If `rustc` isn't found, install it from <https://rustup.rs> and then **open a new
terminal** — rustup only adds itself to the `PATH` of shells started after it
installs. `run.sh` / `build.sh` check the Linux libraries and print the install
line for your distro when something is missing.

### Run it

Windows (PowerShell), from the repository folder:

```powershell
.\run.ps1 -Release
```

macOS / Linux:

```bash
./run.sh --release
```

The first build downloads and compiles roughly 500 crates, so expect 5-15
minutes. Later builds are seconds. Drop `-Release` / `--release` for a
faster-compiling debug build.

There is no app window to look for — the overlay is invisible. You'll know it
worked when the pet appears near the bottom of the screen and a PocketPet icon
shows up in the system tray.

### Use it

- **Move your mouse** — the pet walks, runs and hops after it, and climbs onto
  the titlebars of whatever windows are in the way.
- **Click it** for a reaction, **drag and throw it** to watch it fall and land.
- **Right-click the pet** for the full menu: switch animal, send it to press the
  active window's minimise or close button, and toggle follow / mischief / real
  clicks.
- **Hover on it** for a second and it purrs; **double-click** it to make it
  hop onto the active window and stay there; drag it again to release.
- **Feed / Throw toy** from either menu, then click where the food or toy
  should go. Right-click cancels.
- **Stats** in the pet menu shows a quick view; Settings → Dashboard has each
  pet's history, journal and milestones.
- **Tray icon** has the same actions plus Size, Speed, Break reminder, Run at
  startup, Hide pet and *Settings…* (a proper window with sliders for chatter,
  hunger rate, volume and companion).
- **Ctrl+Alt+P** hides and shows the pet from anywhere by default. Settings →
  Controls lets you change it or add feed, play and settings shortcuts.
- **Quit** from either menu.

Settings persist between runs; the settings window and the overlay share them
live.

### Install it properly

Windows:

```powershell
.\build-installer.ps1
```

This installs the Tauri CLI if needed and produces
`src-tauri\target\release\bundle\nsis\PocketPet_<version>_x64-setup.exe`. Run that to
install PocketPet like any other app.

macOS / Linux:

```bash
./build.sh            # macOS: .app + .dmg   Linux: .deb, .rpm, .AppImage
./build.sh deb        # or just the bundle types you name (comma-separated)
```

Packages land in `src-tauri/target/release/bundle/<type>/`.

### Tests

```bash
npm test              # JS tests, any OS (same as: node scripts/run-tests.mjs)
npm run check         # version consistency + JS tests
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

Pushing source to `main` does not replace an installed app or publish a new
download. Install the newly built installer and restart PocketPet. For public
updates, commit matching versions in `Cargo.toml`, `Cargo.lock`, and
`tauri.conf.json`, then push a new matching `v*` tag. A public Windows release
also needs the signing secrets described in the release steps. See the
[release steps](docs/08_DevOps/CI_CD.md). Settings → About & updates shows the
  installed version and build plus latest published release so you can confirm
  which code is running. Pushing `main` alone does not publish a release.

To start it with Windows, use **Run at startup** in the pet menu or tray menu.

### macOS and Linux

The same code builds on macOS and Linux with a smaller feature set (see
*Known limits*). Tauri does not cross-compile, so each platform builds on its
own machine — GitHub Actions does this for every push and attaches the
packages to tagged releases, which the [website](https://pocketpet-web.vercel.app/)
links to automatically:

| Platform | Package | Notes |
|---|---|---|
| Windows | `PocketPet_x.y.z_x64-setup.exe` | NSIS installer |
| macOS (Apple Silicon) | `PocketPet_x.y.z_aarch64.dmg` | ad-hoc signed, not notarized — see *Opening the unnotarized macOS build* |
| macOS (Intel) | `PocketPet_x.y.z_x64.dmg` | same |
| Linux | `PocketPet_x.y.z_amd64.AppImage`, `.deb`, `PocketPet-x.y.z-1.x86_64.rpm` | needs WebKitGTK 4.1 and (for the AppImage) FUSE 2; X11 or XWayland for click-through and the cursor poller |

#### Opening the unnotarized macOS build

Releases are signed ad-hoc, not with an Apple Developer ID, so Gatekeeper
blocks the first launch. Drag the app to Applications, then either open it
once from Finder with **right-click → Open**, or approve it under **System
Settings → Privacy & Security → Open Anyway**.

If macOS instead says **“PocketPet is damaged and can’t be opened”**, the copy
came from a release built before ad-hoc signing was added. Strip the download
quarantine flag from the whole bundle — `-r` matters, the flag is on the nested
files too:

```bash
xattr -cr /Applications/PocketPet.app
```

#### Installing on Linux

The `.deb` is the recommended package on Debian and Ubuntu — it uses the
system WebKit and GStreamer, so none of the bundling problems below apply:

```bash
sudo apt install ./PocketPet_x.y.z_amd64.deb
pocketpet
```

On Fedora, openSUSE and other RPM distros use the `.rpm`:

```bash
sudo dnf install ./PocketPet-x.y.z-1.x86_64.rpm
```

The AppImage is for everything else:

```bash
chmod +x PocketPet_x.y.z_amd64.AppImage
./PocketPet_x.y.z_amd64.AppImage
```

It needs FUSE 2, which Ubuntu 24.04+ and Fedora 40+ no longer ship. On
`dlopen(): error loading libfuse.so.2`, install it (`sudo apt install
libfuse2t64`, `sudo dnf install fuse-libs`) or run
`./PocketPet_x.y.z_amd64.AppImage --appimage-extract-and-run`.

**AppImages from 0.1.0 have a broken webview.** The pet never appears and the
console shows:

```
GStreamer element appsrc not found. Please install it
GStreamer element autoaudiosink not found. Please install it
```

Tauri's `AppRun` always points `GST_PLUGIN_SYSTEM_PATH_1_0` at the bundle's own
`usr/lib/gstreamer-1.0`, which 0.1.0 shipped empty, so WebKit searched an empty
directory instead of the system one and its media pipeline never came up
([tauri-apps/tauri#15665](https://github.com/tauri-apps/tauri/issues/15665)).
Installing GStreamer packages on the host does not help — the override means
they are never looked at. Later builds set `bundleMediaFramework` and ship the
plugins. Until then, use the `.deb`, or run the bundle against the system
libraries:

```bash
./PocketPet_0.1.0_amd64.AppImage --appimage-extract
rm -f squashfs-root/usr/lib/libgst*.so*
rm -f squashfs-root/usr/lib/lib{glib,gio,gobject,gmodule}-2.0.so*
ln -s /usr/lib/x86_64-linux-gnu/gstreamer-1.0 squashfs-root/usr/lib/gstreamer-1.0
./squashfs-root/AppRun
```

The same over-bundling is behind the noisier `libgvfscommon.so: undefined
symbol: g_task_set_static_name` lines: the AppImage carries the build machine's
GLib 2.72 (Ubuntu 22.04), and a host with GLib 2.76+ has gvfs modules that need
symbols 2.72 does not have. Those messages are harmless.

#### Wayland, NVIDIA and other Linux notes

- **Wayland.** Wayland gives apps no global cursor position and no
  click-through windows, so on a Wayland session PocketPet starts itself on
  XWayland (`GDK_BACKEND=x11`) whenever `DISPLAY` is set. Everything then works
  as on X11. Set `POCKETPET_NATIVE_WAYLAND=1` to stay on native Wayland (the
  pet will not follow the cursor and blocks clicks under it). Without any X
  server the app still starts; it logs that cursor-following is off.
- **Black or invisible overlay** (common on NVIDIA). PocketPet sets
  `WEBKIT_DISABLE_DMABUF_RENDERER=1` unless you already set it; set it to `0`
  to get the DMA-BUF renderer back.
- **No tray icon on GNOME.** Install the *AppIndicator and KStatusNotifierItem
  Support* extension; until then, right-click the pet for the same menu.
- **Global hotkeys** need X11/XWayland as well.

#### Environment variables

| Variable | Platforms | Effect |
|---|---|---|
| `POCKETPET_BROWSER` | all | Full path to the Chromium-family browser the task agent drives (Chrome, Edge, Brave, Chromium, Vivaldi). Default: auto-detect. |
| `POCKETPET_NATIVE_WAYLAND` | Linux | Any value: do not switch to XWayland. |
| `WEBKIT_DISABLE_DMABUF_RENDERER` | Linux | Left alone if set; otherwise PocketPet sets `1`. |
| `XDG_DATA_HOME` | Linux | Data folder becomes `$XDG_DATA_HOME/PocketPet`. |

Programs PocketPet launches (the agent's browser, `xdg-open`) get these
overrides and any AppImage library paths removed, so they behave as if you
started them yourself.

Building locally instead: see [Install it properly](#install-it-properly)
(`./build.sh`).

On macOS the pet needs **Accessibility** permission for the global hotkeys
(System Settings → Privacy & Security → Accessibility). API keys go to the
Keychain (macOS) or the Secret Service keyring (Linux), with a `0600` file
under the data folder as the fallback when no keyring is running.

## Adding an animal

Drop a file in `src/pets/` exporting the same shape as `cat.js` — an SVG using
the shared part classes (`p-head`, `p-arm`, `p-leg-f`, `p-leg-b`, `p-tail`,
`p-eye`), a `paw` anchor, and a `lines` table — then register it in
`src/pets/index.js` and add it to `PETS` in `src-tauri/src/lib.rs` so it shows
up in the tray menu. All the animation comes from `styles.css` and applies to
any pet that uses those class names.

## Layout

```
run.ps1, build-installer.ps1   Windows: run from source / build the installer
run.sh, build.sh               macOS + Linux equivalents (scripts/check-deps.sh)
package.json                   test scripts only (npm test, npm run check)
tests/*.test.mjs               JS tests (node scripts/run-tests.mjs)
src/                     frontend (plain ES modules, no build step)
  main.js                physics, AI, drag, missions, hit-region reporting
  platform.js            which OS the webview runs on, per-OS wording
  styles.css             every animation, shared across all four animals
  pets/*.js              SVG + dialogue per animal
src-tauri/
  src/win.rs             cursor, virtual screen, window enumeration, clicking (Windows)
  src/titlebar.rs        caption button detection (3 strategies) (Windows)
  src/startup.rs         Run key + RegisterHotKey thread (Windows)
  src/extras.rs          monitors, file dialogs, clipboard, updates (Windows)
  src/unix.rs            macOS/Linux versions of the four modules above + keychain
  src/geom.rs, paths.rs  shared Rect/WindowInfo, per-OS data folder, Linux
                         environment fixes and clean child-process environments
  src/lib.rs             commands, overlay setup, cursor thread, tray
```

## Known limits

- **Windows is the full experience.** Everything that looks at *other* apps'
  windows is Win32/UIA: walking on titlebars, pressing caption buttons,
  mischief mode, "sit on the active window", fullscreen detection, and the
  offline Windows speech recogniser. On macOS and Linux the pet still follows
  the cursor, talks, eats, plays, runs tasks and drives its browser, but the
  window list is empty, so those tricks are greyed out. Keychain, autostart
  (LaunchAgent / XDG autostart), file dialogs and global hotkeys come from
  crates instead of Win32.
- macOS clips a window to one display, so the overlay covers the main screen
  only. Linux click-through needs X11 or XWayland (used automatically on
  Wayland sessions); without any X server the pet cannot follow the cursor
  and blocks clicks under it.
- Per-app pet modes need the foreground app's executable name, which only
  Windows exposes; the card is greyed out on macOS and Linux.
- Elevated (admin) windows can't be driven by a non-elevated process; the pet
  will walk over and the press will silently do nothing.
- Pets walk on window *top edges* only — no wall-climbing or ceiling-hanging
  yet.

## Website

The download page at <https://pocketpet-web.vercel.app/> lives in its own
repo, [Pocketpet-web](https://github.com/vigneshcj001/Pocketpet-web) (React +
Tailwind on Vite, deployed by Vercel). It runs the same sprites as this app
and reads the latest release from the GitHub API, so publishing a `v*` tag
here is all it takes to update the site's buttons.

## Documents

Full documentation tree in [docs/](docs/README.md):

| Folder | Contents |
|--------|----------|
| [01_Product](docs/01_Product/) | PRD, business requirements, user stories |
| [02_Requirements](docs/02_Requirements/) | SRS, NFRs, acceptance criteria |
| [03_Architecture](docs/03_Architecture/) | system, agentic, data and API architecture |
| [04_Agents](docs/04_Agents/) | agent registry, requirements, workflows, tool registry, memory, human-in-the-loop |
| [05_AI](docs/05_AI/) | model strategy, prompt design, retrieval, evaluation, guardrails |
| [06_Engineering](docs/06_Engineering/) | technical design, coding standards, git strategy |
| [07_Testing](docs/07_Testing/) | test plan, agent evaluation, security and performance testing |
| [08_DevOps](docs/08_DevOps/) | CI/CD, deployment, environment config, rollback |
| [09_Security](docs/09_Security/) | security architecture, access control, data privacy, AI security |
| [10_Operations](docs/10_Operations/) | monitoring, incident runbook, cost monitoring |
| [11_Governance](docs/11_Governance/) | AI governance, audit logging, model/prompt versioning |
| [12_Releases](docs/12_Releases/) | changelog, release notes |
