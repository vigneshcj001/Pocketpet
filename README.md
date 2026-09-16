# PocketPet

A desktop pet for Windows. One animal — cat, duck, panda or penguin — lives in a
transparent overlay that spans every monitor. It chases your cursor, perches on
the titlebars of your real windows, talks to you, and can walk over to a
window's caption buttons and press them with its paw.

Built with Tauri v2 (Rust + WebView2). No Electron, no npm, no bundler.

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
- **Feed it.** Hunger creeps up over the day (even while the app is closed).
  Pick *Feed*, click anywhere, and it runs over and eats. A starving pet slows
  down and nags.
- **Fetch.** *Throw ball* lobs a ball where you click; the pet chases it down
  and brings it back to you.
- **Pet it.** Rest the cursor on it for a second: purring and hearts. Click for
  a pat, double-click to send it up onto the window you're working in.
- **A life of its own.** Yawns, stretches, looks around, spins, wanders, peeks
  over window edges when the cursor is still; sleeps sooner late at night and
  greets you by time of day.
- **Break reminder.** Every 25/45/60 min it walks to the middle of the screen,
  stretches and asks you to. Toast notification instead if it is hidden.
- **Companion.** A second animal that tags along behind the first.
- **Your own picture as a pet.** Any PNG/GIF/JPG under 1.5 MB.
- **Sounds.** Synthesised chirp, purr, munch and boing — no audio files. Mute
  and volume in settings.
- **Size, speed, run-at-startup, Ctrl+Alt+P to hide/show,** a settings window,
  and a keyboard-navigable, theme-aware right-click menu.
- **Multi-monitor aware.** Stands on the bottom of *its* screen, not the
  tallest one. Pick a monitor, set an edge margin, keep it to the bottom
  strip, or mark a keep-out area it must never enter.
- **Focus mode.** Hides, or goes quiet (no talking, sounds, nags, wandering),
  when a fullscreen app is in front or during your quiet hours.
- **Breaks, properly.** Any interval, snooze (right-click the pet), a
  countdown pill above it, and optional timed work/break sessions.
- **Make it yours.** Name, colour, personality (playful / calm / sleepy) and
  unlockable accessories per pet. Up to 12 custom-image pets, auto-cropped
  and shrunk.
- **Companion that counts.** Feed, pat and cuddle the second pet too; it has
  its own hunger and history and chases the toy alongside.
- **Toys and games.** Ball, yarn or frisbee for fetch; obstacle-jump and
  hide-and-seek mini-games with a win record.
- **Dashboard.** Per-pet counters, milestones with progress, a journal, and
  accessories that unlock as you go.
- **Shortcuts you choose.** Hide/show, feed, throw and settings hotkeys are
  all rebindable; speech-bubble size and duration are adjustable.
- **Battery-friendly.** Drops to 15 fps and scans windows less when hidden,
  asleep, or in low-power mode.
- **Backup & restore.** Export everything to a JSON file and import it on
  another machine.

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

### Prerequisites

| Need | Why | Check |
|---|---|---|
| Rust (stable, MSVC host) | compiles the app | `rustc --version` |
| Visual Studio C++ Build Tools 2022 | provides the MSVC linker | `vswhere` / Visual Studio Installer |
| WebView2 runtime | renders the pet; ships with Windows 11 | already present on Win10 21H2+ and Win11 |

If `rustc` isn't found, install it from <https://rustup.rs> and then **open a new
terminal** — rustup only adds itself to the `PATH` of shells started after it
installs.

### Run it

```powershell
cd D:\PetExt
.\run.ps1 -Release
```

The first build downloads and compiles roughly 500 crates, so expect 5-15
minutes. Later builds are seconds. Drop `-Release` for a faster-compiling debug
build.

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
- **Feed / Throw ball** from either menu, then click where the food or ball
  should go. Right-click cancels.
- **Stats** in the pet menu shows hunger, meals, pats and days together.
- **Tray icon** has the same actions plus Size, Speed, Break reminder, Run at
  startup, Hide pet and *Settings…* (a proper window with sliders for chatter,
  hunger rate, volume and companion).
- **Ctrl+Alt+P** hides and shows the pet from anywhere.
- **Quit** from either menu.

Settings persist between runs; the settings window and the overlay share them
live.

### Install it properly

```powershell
.\build-installer.ps1
```

This installs the Tauri CLI if needed and produces
`src-tauri\target\release\bundle\nsis\PocketPet_0.1.0_x64-setup.exe`. Run that to
install PocketPet like any other app.

To start it with Windows, press `Win+R`, run `shell:startup`, and drop a
shortcut to the installed `PocketPet.exe` into that folder.

## Adding an animal

Drop a file in `src/pets/` exporting the same shape as `cat.js` — an SVG using
the shared part classes (`p-head`, `p-arm`, `p-leg-f`, `p-leg-b`, `p-tail`,
`p-eye`), a `paw` anchor, and a `lines` table — then register it in
`src/pets/index.js` and add it to `PETS` in `src-tauri/src/lib.rs` so it shows
up in the tray menu. All the animation comes from `styles.css` and applies to
any pet that uses those class names.

## Layout

```
src/                     frontend (plain ES modules, no build step)
  main.js                physics, AI, drag, missions, hit-region reporting
  styles.css             every animation, shared across all four animals
  pets/*.js              SVG + dialogue per animal
src-tauri/
  src/win.rs             cursor, virtual screen, window enumeration, clicking
  src/titlebar.rs        caption button detection (3 strategies)
  src/lib.rs             commands, overlay setup, cursor thread, tray
```

## Known limits

- Windows only. The Win32/UIA layer has no macOS or Linux equivalent here.
- Elevated (admin) windows can't be driven by a non-elevated process; the pet
  will walk over and the press will silently do nothing.
- Pets walk on window *top edges* only — no wall-climbing or ceiling-hanging
  yet.
