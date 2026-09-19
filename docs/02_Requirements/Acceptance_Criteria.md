# Acceptance Criteria

Given/When/Then per feature. All must pass before a tagged release.

## Pet
- **Follow**: Given follow is on, when the cursor moves 800 px, then the pet arrives within ~110 px in < 3 s and stops.
- **Ledges**: Given a normal window, when the pet walks onto its top edge, then it stands there; when the window is minimised, then it falls to the floor.
- **Close button**: Given "Close active window", when chosen, then the pet asks and only acts on a second click; the window closes via `WM_SYSCOMMAND`.
- **Focus mode**: Given a fullscreen app in front, then within 2 s the pet is quiet/hidden; when it ends, then the pet is back within 2 s.

## Care
- **Feed**: Given "Feed", when I click anywhere, then food lands on the ledge under the click, the pet eats it, hunger drops by 55, `meals` +1, journal entry added.
- **Games**: Given "obstacle jump", then a playfield appears; Space jumps; Esc ends; `games` +1; a win adds `wins` +1.
- **Hide & seek**: Given "hide & seek", when the box closes, then nothing of the pet (body, hunger bar, hat, countdown) is visible while boxes shuffle; 1/2/3 or a click picks; 3 of 5 wins.

## Task agent
- **Research**: Given a Gemini key, when I ask the current Rust version, then the answer contains a `1.xx.x` version and a source URL, streamed, in < 60 s.
- **Browser**: When I ask for the first book on books.toscrape.com, then the browser opens, the pet sits on it, the answer contains title, price and stock.
- **Gate — click**: When the model tries to click "Log in", then an approval card appears directly under the task box (scrolled into view, Allow focused, no free-text row); Don't → the model reports the owner declined; nothing was clicked.
- **Progress card**: Given a running task, then the state chip reads "Working" with a pulsing dot, the elapsed timer ticks each second, each log line carries `m:ss`; on finish the chip reads Done/Failed and the answer card scrolls into view.
- **Gate — URL**: When the model opens a `Special:UserLogin` URL, then an approval card appears first.
- **Gate — secret**: When the model tries `type_text` into a password field, then it is refused with an ask_user hint.
- **Purchase cap**: Given cap 100, when the page total is 548 and the model clicks "Place order", then the click is refused regardless of approval.
- **Spend cap**: Given daily cap $0.01, when a task starts, then it stops with "passed your spend cap" after the first turn.
- **Kill switch**: Given a running task with an open browser, when Ctrl+Alt+X, then status is Cancelled and the browser process is gone within 2 s.
- **Follow-up**: Given "Continue previous task" ticked, when I ask "shorten that", then the answer references the previous content.
- **Memory**: When the model calls `remember`, then the fact appears in the Memory tab and in the next task's prompt.
- **Schedule**: Given a schedule at now+1 min, then the task runs once, a toast appears, history has the entry with id `sched-…`.
- **Voice**: Given the Windows engine and speech enabled in Windows, when I press 🎤 and speak, then the text lands in the task box.

## Platform
- **Installer (Windows)**: Running the setup silently installs to `%LOCALAPPDATA%\PocketPet`, creates a Start Menu entry, and launches.
- **macOS**: Opening the DMG and dragging to Applications yields an app that launches after right-click → Open (unsigned); the pet appears on the main display; no Dock icon.
- **Linux**: `chmod +x` + run the AppImage (or `apt install ./*.deb`) launches on X11/XWayland; the pet is click-through.
- **Download page**: On https://pocketpet-web.vercel.app/ the visitor's OS card is marked and every button links to the matching asset of the latest release.
- **Update**: Given a newer tagged release, when checking, then it is offered; on Windows install downloads the `-setup.exe` from GitHub, launches it and exits; on macOS/Linux the matching `.dmg` / `.AppImage` is downloaded and opened.
- **Backup**: Export then import on a clean profile restores pets, names, colours, rules, schedules, history — and no keys.
