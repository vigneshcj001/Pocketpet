# Release Notes

Downloads: <https://pocketpet-web.vercel.app/> · all builds on [GitHub Releases](https://github.com/vigneshcj001/Pocketpet/releases).

## PocketPet 0.1.0

Your desktop pet that also runs errands.

**Highlights**
- A cat, duck, panda or penguin (or your own picture) that follows your cursor, sits on your windows, plays, eats and sleeps.
- Break reminders and a focus mode that keeps it out of the way during games and meetings.
- **Ask me to do something**: type or say an errand — it searches, reads, and drives its own browser window; it stops and asks before paying, booking, logging in or sending. Works with Claude, OpenAI, Groq, Gemini, DeepSeek, Ollama or any OpenAI-compatible server. Keys stay in your OS keychain.

**Install**
- Windows 10/11 x64: `PocketPet_0.1.0_x64-setup.exe` (per-user, no admin).
- macOS 11+: `PocketPet_0.1.0_aarch64.dmg` (Apple Silicon) or `PocketPet_0.1.0_x64.dmg` (Intel). Unsigned — right-click → Open the first time.
- Linux x86-64 (X11/XWayland): `PocketPet_0.1.0_amd64.AppImage` or `.deb`.

Or let <https://pocketpet-web.vercel.app/> pick for you.

**Known limits**: window tricks (ledge walking, caption buttons, mischief, sit-on-window, fullscreen detection, offline dictation) are Windows-only; macOS overlay covers the main display; Linux needs X11 for click-through; regex-based gates may miss unusual buttons — watch the browser and keep the kill switch (Ctrl+Alt+X) handy; Windows speech needs online speech recognition enabled; Gemini retires models often — use ↻ to refresh the list.

**Eval**: 6 scripted tasks pass on Gemini 3.6 flash (see `tests/eval-results.json` when generated).
