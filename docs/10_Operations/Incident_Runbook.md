# Incident Runbook

## Agent did something unexpected
1. Ctrl+Alt+X (stop all). 2. Open the task log (History › Log). 3. Identify the tool call and whether a gate fired. 4. If a gate should have fired: file a bug with the element text/URL; add it to the regex and a unit test. 5. Consider a site rule `never` meanwhile.

## Task keeps failing with a provider error
1. Read the verbatim message (400 model retired, 401 key, 429 rate limit, 5xx). 2. ↻ model list; pick a current model. 3. Re-save the key. 4. Try another provider.

## Browser will not open
1. Confirm Chrome, Edge, Brave, Chromium or Vivaldi is installed, or point `POCKETPET_BROWSER` at a Chromium build. 2. Close the pet's browser (Limits & sites). 3. Delete `<data dir>/browser` (`%LOCALAPPDATA%\PocketPet` · `~/Library/Application Support/PocketPet` · `$XDG_DATA_HOME/PocketPet`) if the profile is corrupt (sessions will be lost).

## Pet invisible / not moving
1. Ctrl+Alt+P (hidden?). 2. Focus mode active? (fullscreen app / quiet hours). 3. Follow cursor off? 4. Check `logs/` for a panic.

## Linux: pet invisible, black box, or not following the cursor
1. Black/blank overlay: make sure `WEBKIT_DISABLE_DMABUF_RENDERER` is not set to `0`. 2. Wayland: check that XWayland runs (`echo $DISPLAY` is non-empty) and that `POCKETPET_NATIVE_WAYLAND` is unset. 3. No tray icon on GNOME: install the AppIndicator extension or use the pet's right-click menu. 4. AppImage won't start: install FUSE 2 (`libfuse2t64` / `fuse-libs`) or use the `.deb` / `.rpm`.

## Voice not working
Windows engine → enable Settings › Privacy & security › Speech › Online speech recognition; or switch to Whisper with a Groq/OpenAI key.

## Update failed
Download the package for your OS from <https://pocketpet-web.vercel.app/> (or GitHub Releases) manually and run it.
