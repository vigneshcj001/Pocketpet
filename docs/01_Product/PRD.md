# Product Requirements Document — PocketPet

Version 0.1 · September 2026 · Owner: vigneshcj001

## 1. Summary

PocketPet is a Windows desktop pet that also runs web errands. It lives on the
desktop as a click-through overlay, reacts to the user (follows the cursor,
sits on windows, plays, eats, sleeps), keeps them healthy (break reminders,
focus mode), and — on request, by text or voice — searches the web, reads
pages and drives a real browser to research, shop and book, stopping for a
human click at every commitment point.

## 2. Problem

- Desktop pets are charming but useless after day one.
- AI "agents" that browse for you are either cloud services you must trust
  with logins and cards, or developer tools with no personality and no safety.
- People want a helper that is present, cheap, private, and never buys
  anything on its own.

## 3. Target users

| Persona | Needs | Success looks like |
|---------|-------|--------------------|
| Everyday desktop user | company, reminders, "find/order/book for me" | keeps it running daily; delegates 2–3 errands a week |
| Tinkerer | own keys / local models, customisation, hotkeys | switches providers freely; tunes personality, rules |
| Developer | build, test, extend | green CI on three OSes, one-command installer, clear extension points |

## 4. Product principles

1. **Delight first.** The pet is fun even with the agent switched off.
2. **Human in the loop.** Nothing irreversible without an explicit Allow.
3. **Bring your own model.** Any provider; local models welcome.
4. **Local by default.** Keys, memory, logs stay on the machine. No telemetry.
5. **Cheap.** Streaming, digest model, caps; a task should cost cents.

## 5. Features (shipped in 0.1)

| Area | Features |
|------|----------|
| Pet | cursor following, ledge walking, window-button pressing, drag/throw, perch, speech bubbles, 4 animals + custom images, colours, accessories, personalities, companion |
| Care | hunger/feeding, fetch with three toys, two mini-games, petting, stats, milestones, journal |
| Wellbeing | break reminders (snooze, countdown, cycles), focus mode, quiet hours, toasts |
| Agent | text/voice tasks; web search + fetch; browser driving; plans; streaming; approvals; site rules; purchase & spend caps; memory; schedules; follow-ups; audit logs; kill switch |
| Platform | Windows (full), macOS, Linux; tray, hotkeys, run at startup, low-power, multi-monitor, backup/restore, update check, window state; download page at https://pocketpet-web.vercel.app/ |

## 6. Non-goals (0.x)

macOS/Linux, cloud sync, autonomous payments, app-store distribution.

## 7. Release criteria

See `02_Requirements/Acceptance_Criteria.md` and `07_Testing/Test_Plan.md`.

## 8. Open questions

- Local speech-to-text without the Windows online policy (whisper.cpp)?
- Site playbooks (Swiggy/Amazon.in) to raise task completion rate?
- Code signing budget for a signed installer / notarised DMG?
