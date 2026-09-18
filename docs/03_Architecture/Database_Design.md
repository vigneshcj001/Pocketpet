# Data Design

There is no database server. Data lives in four local stores.

## 1. localStorage `pocketpet` (JSON, validated by `preferences.js`)

Top level (abridged):

| Key | Type | Notes |
|-----|------|-------|
| pet, companion | id | built-in id or `custom:<id>` |
| size, speed, toy, follow, mischief, realClick, sound, volume, chatter | scalars | |
| hunger, buddyHunger, hungerAt, hungerRate, pauseHungerOffline, showHunger | | hunger model |
| customPets[] | {id, name, image(dataURL ≤ 1.8 MB)} | ≤ 12 |
| petNames{}, personalities{}, colors{}, accessories{} | per pet id | colour = hex; accessories = [{emoji, slot, size, x, y}] ≤ 4 |
| profiles{} | per pet id → {meals, pats, pets, fetches, games, wins, breaks, tasks, firstRun, journal[≤40]} | |
| stats | global counters | legacy + totals |
| focusFullscreen, focusAction, quietHours, quietStart, quietEnd | | focus mode |
| monitor, roamMargin, roamBottomOnly, avoidArea{enabled,x,y,w,h} | | movement |
| breakMins, breakDuration, breakSnooze, breakCycles, showCountdown, toasts | | breaks |
| speechSize, speechDuration, lowPower | | |
| shortcuts{toggle, feed, play, settings, tasks, kill, voice, clip} | strings | |
| agent{…} | see below | |
| tasks[] | {id, at, task, provider, model, status, answer(≤8 k)} ≤ 50 | history |

`agent`: provider, models{provider→model}, baseUrls{}, maxTurns, narrate,
browser, allowedSites[], siteRules{domain→allow|ask|never}, dailyCapUsd,
purchaseCap, spend{date, usd}, digestModel, stream, speak, voice, voiceEngine,
schedules[{id, task, time, days, enabled, lastRun}], updateCheck, lastUpdateCheck.

Write discipline: `writeSettings(patch)` = read → shallow-merge (nested maps
merged one level) → normalize → write. Overlay is the sole writer of `tasks`
and `agent.spend`.

## 2. Windows Credential Manager

Generic credentials `PocketPet/<provider>`, user `api-key`, blob = key bytes,
persist LOCAL_MACHINE. Read on demand; never cached in JS.

## 3. Files under `%LOCALAPPDATA%\PocketPet\`

| Path | Format | Retention |
|------|--------|-----------|
| `memory.md` | markdown bullets ≤ 6 000 chars | until edited/cleared |
| `tasks/<id>.log` | TSV `epoch\tkind\ttext` | forever (user may delete) |
| `logs/panic-<ts>.log` | text | forever |
| `browser/` | Chromium profile | forever; "Close the pet's browser" keeps it |

## 4. Registry

`HKCU\Software\Microsoft\Windows\CurrentVersion\Run\PocketPet` = `"<exe>"` when run-at-startup is on.

## Backup format

```json
{ "app": "PocketPet", "version": 1, "exportedAt": "…", "settings": { …localStorage… } }
```
Keys are structurally absent. Import runs `parseBackup` (schema + image checks).
