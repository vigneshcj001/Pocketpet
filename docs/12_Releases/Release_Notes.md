# Release Notes

## PocketPet 0.1.0

Your desktop pet that also runs errands.

**Highlights**
- A cat, duck, panda or penguin (or your own picture) that follows your cursor, sits on your windows, plays, eats and sleeps.
- Break reminders and a focus mode that keeps it out of the way during games and meetings.
- **Ask me to do something**: type or say an errand — it searches, reads, and drives its own browser window; it stops and asks before paying, booking, logging in or sending. Works with Claude, OpenAI, Groq, Gemini, DeepSeek, Ollama or any OpenAI-compatible server. Keys stay in Windows Credential Manager.

**Install**: run `PocketPet_0.1.0_x64-setup.exe` (per-user, no admin). Windows 10/11 x64.

**Known limits**: Windows only; regex-based gates may miss unusual buttons — watch the browser and keep the kill switch (Ctrl+Alt+X) handy; Windows speech needs online speech recognition enabled; Gemini retires models often — use ↻ to refresh the list.

**Eval**: 6 scripted tasks pass on Gemini 3.6 flash (see `tests/eval-results.json` when generated).
