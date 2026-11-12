# Release Notes

Downloads: <https://pocketpet-web.vercel.app/> · all builds on [GitHub Releases](https://github.com/vigneshcj001/Pocketpet/releases).

## PocketPet 0.2.4

Better on macOS and Linux, same pet everywhere.

**Highlights**
- Linux: works on Wayland desktops (runs through XWayland automatically), no more black overlay on NVIDIA, no crash when no X display exists, and the pet's browser no longer breaks when started from the AppImage.
- New `.rpm` for Fedora and openSUSE alongside the AppImage and `.deb`; in-app updates now fetch the same package type you installed.
- Pick any Chromium browser for errands with `POCKETPET_BROWSER`; more browsers are found automatically (Vivaldi, per-user Brave/Chromium, Flatpaks).
- Settings and Tasks talk about *your* OS: Keychain / Secret Service / Credential Manager, ⌘ / Super / Win.
- The website recommends the right Mac build (Apple Silicon or Intel) when the browser can tell.

**Install**
- Windows 10/11 x64 (and Windows on ARM via emulation): `PocketPet_0.2.4_x64-setup.exe`.
- macOS 11+: `PocketPet_0.2.4_aarch64.dmg` (Apple Silicon) or `PocketPet_0.2.4_x64.dmg` (Intel). Not notarized — right-click → Open the first time.
- Linux x86-64: `PocketPet_0.2.4_amd64.deb` (Debian/Ubuntu), `PocketPet-0.2.4-1.x86_64.rpm` (Fedora/openSUSE) or `PocketPet_0.2.4_amd64.AppImage` (anything else; needs FUSE 2).

## PocketPet 0.1.0

Your desktop pet that also runs errands.

**Highlights**
- A cat, duck, panda or penguin (or your own picture) that follows your cursor, sits on your windows, plays, eats and sleeps.
- Break reminders and a focus mode that keeps it out of the way during games and meetings.
- **Ask me to do something**: type or say an errand — it searches, reads, and drives its own browser window; it stops and asks before paying, booking, logging in or sending. Works with Claude, OpenAI, Groq, Gemini, DeepSeek, Ollama or any OpenAI-compatible server. Keys stay in your OS keychain.

**Install**
- Windows 10/11 x64: `PocketPet_0.1.0_x64-setup.exe` (per-user, no admin).
- macOS 11+: `PocketPet_0.1.0_aarch64.dmg` (Apple Silicon) or `PocketPet_0.1.0_x64.dmg` (Intel). Ad-hoc signed, not notarized — right-click → Open the first time, or System Settings → Privacy & Security → Open Anyway. If a build says “PocketPet is damaged and can’t be opened” it predates ad-hoc signing: `xattr -cr /Applications/PocketPet.app`.
- Linux x86-64 (X11/XWayland): use `.deb` — `sudo apt install ./PocketPet_0.1.0_amd64.deb`. **The 0.1.0 AppImage is broken**: it bundles no GStreamer plugins while `AppRun` still overrides `GST_PLUGIN_SYSTEM_PATH_1_0`, so WebKit reports `GStreamer element appsrc not found` and the pet never appears. Fixed in the next release; workaround in the README.

Or let <https://pocketpet-web.vercel.app/> pick for you.

**Known limits**: window tricks (ledge walking, caption buttons, mischief, sit-on-window, fullscreen detection, offline dictation) are Windows-only; macOS overlay covers the main display; Linux needs X11 for click-through; regex-based gates may miss unusual buttons — watch the browser and keep the kill switch (Ctrl+Alt+X) handy; Windows speech needs online speech recognition enabled; Gemini retires models often — use ↻ to refresh the list.

**Eval**: 6 scripted tasks pass on Gemini 3.6 flash (see `tests/eval-results.json` when generated).
