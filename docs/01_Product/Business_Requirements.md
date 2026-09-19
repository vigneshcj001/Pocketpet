# PocketPet — Business Requirements

Version 0.1 · September 2026 · Owner: vigneshcj001

## 1. Vision

A desktop companion that is fun to have around all day and quietly useful: it
lives on the Windows desktop, reacts to you, reminds you to take breaks — and
when you ask, runs errands on the web for you (research, shopping up to the
payment step, bookings up to confirmation) while you watch and approve.

## 2. Goals

| # | Goal | Measure |
|---|------|---------|
| G1 | Delight: people keep it running | Median session > 4 h/day; uninstall < 10 % in week 1 |
| G2 | Useful: the pet does real errands | ≥ 70 % of tasks end in "done" without the user taking over |
| G3 | Safe: nothing irreversible without consent | 0 purchases / logins / sends without an explicit Allow |
| G4 | Cheap: model cost stays small | Typical task < $0.05; daily cap default $2 |
| G5 | Private: keys and data stay on the machine | No key leaves the OS keychain (Credential Manager / Keychain / Secret Service); no telemetry |
| G6 | Provider-agnostic | Works with Claude, OpenAI, Groq, Gemini, DeepSeek, Ollama, any OpenAI-compatible server |

## 3. Users

- **Everyday desktop user** (primary): wants a cute pet, break reminders, and
  "find me / order me / book me" without learning a tool.
- **Tinkerer**: brings their own API key or local model, tunes personality,
  colours, accessories, hotkeys, site rules.
- **Developer** (this repo): builds, tests, and ships from the command line.

## 4. Scope

### In scope (shipped)

- Desktop pet: follows the cursor, walks on window titlebars, presses real
  caption buttons, is draggable/throwable, talks, sleeps, plays, eats.
- Care loop: hunger, feeding, fetch, two mini-games, petting, stats, journal,
  milestones, companion pet, custom-image pets, colours, accessories.
- Wellbeing: break reminders with snooze/countdown/cycles, focus mode
  (fullscreen apps, quiet hours), toasts.
- Task agent: text or voice task → web search, page reading, real browser
  driving; streams progress; plans; asks for approval at commitment points;
  memory of preferences; schedules; audit logs; spend and purchase caps.
- Distribution: Windows NSIS installer, macOS DMG, Linux AppImage/deb via GitHub Releases and the download page <https://pocketpet-web.vercel.app/>; run-at-startup, update
  check against GitHub Releases, CI build on push.

### Out of scope (for now)

- macOS / Linux.
- Multi-user or cloud sync (settings are local; backup is a file).
- Autonomous payments. The pet never completes a purchase, login, or send
  without a human click.
- App-store distribution / code signing.

## 5. Business rules

| Rule | Detail |
|------|--------|
| BR1 Consent gate | Any click whose text/URL implies paying, ordering, booking, logging in, sending, or deleting requires an explicit Allow in the Tasks window. Per-site "always allow" is the user's choice, revocable. |
| BR2 No secrets typed | The agent refuses password, card, CVV, OTP fields; the user fills them in the pet's browser. |
| BR3 Purchase cap | If a page total exceeds the configured cap, pay/order clicks are refused even if the user would approve. |
| BR4 Spend cap | Model spend is estimated per turn; a task stops when the daily cap is reached. |
| BR5 Allowed sites | With a non-empty allow-list, leaving it requires approval. |
| BR6 Local data | Keys in the OS keychain (Windows Credential Manager, macOS Keychain, Linux Secret Service; `0600` file fallback when no keyring runs); settings/localStorage, memory.md, task logs under the per-OS data folder (`%LOCALAPPDATA%\PocketPet` · `~/Library/Application Support/PocketPet` · `$XDG_DATA_HOME/PocketPet`). Backups never include keys. |
| BR7 Honest answers | The agent must cite page URLs and say "not found" rather than invent. |
| BR8 Kill switch | One hotkey stops every task and closes the pet's browser. |

## 6. Success criteria for v1.0

- 30 scripted eval tasks (`tests/eval-tasks.json`) pass ≥ 90 % on two providers.
- Zero gate bypasses in the eval (login/checkout URL and click gates).
- All four packages (Windows, macOS ×2, Linux) build green in CI on every push; a tagged release publishes them; the in-app update check and the download page find them.
- No crash reports in `logs/` over one week of daily use by the owner.

## 7. Risks

| Risk | Mitigation |
|------|------------|
| Sites block automation (CAPTCHA, bot detection) | Pause/take-over; ask_user; dedicated persistent browser profile with prior sign-in |
| Model hallucinates a result | Prompt rules + citations + eval set |
| Runaway cost | Daily cap, per-task cap, digest model, max steps |
| Provider API drift (e.g. Gemini retiring models) | Model list fetched live; errors surfaced verbatim; default model kept current |
| Cross-window settings races | Overlay is the single writer for history/spend |

## 8. Roadmap (candidate)

1. Local speech-to-text without Windows online policy (whisper.cpp).
2. Second-pet task runner and shared queue.
3. Site-specific playbooks (Swiggy/Zomato/Amazon.in flows) to raise G2.
4. Signed installer and Microsoft Store listing; Apple notarisation; Flatpak.
5. macOS/Linux parity for window-aware tricks where the platform allows (Accessibility API on macOS, X11 `_NET_CLIENT_LIST` on Linux).
