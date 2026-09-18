# PocketPet — App Flow

Version 0.1 · September 2026

## 1. Launch

```mermaid
flowchart TD
  A[pocketpet.exe starts] --> B[Rust: create overlay window<br/>span virtual screen, no-activate, click-through]
  B --> C[Build tray menu · spawn cursor thread 60 Hz · register hotkeys]
  C --> D[Overlay JS boot: readSettings → mount pet, companion, size, toy]
  D --> E[get_screen · list_windows · get_autostart · sync_tray]
  E --> F[Timers: window scan 0.7 s · hunger 30 s · schedules 30 s · env poll 2 s · update check once/day]
  F --> G[requestAnimationFrame loop]
```

First run: fresh settings from `preferences.js` defaults; hunger 20 %; no keys;
tray shows **Ask me to do something…**, **Settings…**.

## 2. Every frame (overlay)

```mermaid
flowchart LR
  T[frame] --> H{hidden?}
  H -- yes --> S[schedule next frame 15 fps]
  H -- no --> G{game active?}
  G -- yes --> GT[games.tick]
  G -- no --> D{dragging?}
  D -- yes --> DA[anim drag]
  D -- no --> M{mode free?}
  M -- yes --> SF[stepFree: chase cursor / antics / gravity / ledges / bounds / keep-out]
  M -- no --> X[mission or break drives position via moveTo]
  SF --> P[applyTransform · ball · buddy · countdown · hit regions]
  GT --> P
  DA --> P
  X --> P
  P --> S
```

Hit regions (pet, bubble, menu, buddy, game controls) are sent to Rust only
when they change; the cursor thread flips click-through per frame.

## 3. Interaction map

| User does | What happens |
|-----------|--------------|
| Moves mouse | Pet walks/runs after it, hops ledges, climbs to a window above |
| Hovers ≥ 0.9 s | Purr, hearts, `pets` +1 |
| Click | Pat, `pats` +1; during a break: ends break |
| Double-click | Hops onto the active window's titlebar and perches |
| Drag & drop | Gentle drop mid-air → perches; throw → flies, lands with squash |
| Right-click | HTML menu (keyboard-navigable): tasks, feed, toy, games, stats, window actions, pets, toggles, settings |
| Tray | Same actions + size/speed/break radios, autostart, hide, tasks, settings |
| Ctrl+Alt+P / F / B / S / T / V / D / X | Hide-show / feed / toy / settings / tasks / voice / clipboard task / kill switch |

## 4. Care loop

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Hungry: hunger ≥ 70 (nags)
  Hungry --> Starving: hunger ≥ 90 (60 % speed)
  Idle --> Placing: Feed / Throw chosen
  Placing --> Eating: click anywhere → food lands on ledge → eatMission
  Placing --> Fetching: click → toy lobbed → fetchMission → returns to you
  Eating --> Idle: hunger −55, meals +1, journal entry
  Fetching --> Idle: fetches +1
  Idle --> Game: obstacle jump / hide & seek
  Game --> Idle: games +1, wins +1 on success
  Idle --> Sleep: cursor idle > 25 s (9 s late night / sleepy)
```

Milestones (bow/star/crown) unlock from per-pet counters; the dashboard in
Settings shows counters, milestones and the journal.

## 5. Breaks & focus

```mermaid
sequenceDiagram
  participant T as Timer
  participant P as Pet
  participant U as User
  T->>P: breakMins elapsed
  alt hidden or quiet
    P->>U: Windows toast
  else free
    P->>P: walk to screen centre, stretch, countdown pill
    P->>U: "Break time… click me when back / right-click to snooze"
    U-->>P: click → welcome back, breaks +1 (if ≥45 s)
    U-->>P: right-click → snooze N min
    T-->>P: breakDuration elapsed (cycles on) → auto-end
  end
```

Focus mode: `get_environment` every 2 s → fullscreen app or quiet hours →
**quiet** (no chatter/sounds/nags/wandering) or **hide** (restores itself).

## 6. Task agent — end to end

```mermaid
sequenceDiagram
  participant U as User (Tasks window)
  participant R as agent.rs
  participant L as LLM
  participant B as browser.rs (Chromium)
  participant O as Overlay pet

  U->>R: agent_run{task, provider, model, limits…}
  R->>O: start (pet: "On it!")
  loop up to maxTurns (streamed)
    R->>L: messages + tools (SSE)
    L-->>R: delta text → U (live answer) · tool calls
    alt tool = open_browser / click / type…
      R->>R: allow-list · sensitive URL/click · secret field · purchase cap
      opt approval needed
        R->>U: confirm{host} (pet says "need your okay")
        U-->>R: Allow / Don't / Always on site / Never on site
      end
      R->>B: navigate / dispatchMouseEvent / insertText
      B-->>R: read_page (elements + text) · follow new tab
      R->>O: act{x,y} (pet points paw) · browser{pid} (pet sits on window)
    else tool = web_search / fetch_page
      R->>R: DuckDuckGo HTML / GET + html_to_text
    else tool = ask_user / remember / set_plan / update_step
      R->>U: ask / plan / step events
    end
    R->>R: digest long output · charge usage · loop guard
  end
  L-->>R: final text
  R->>U: answer (+ usd) · R->>O: answer (bubble, journal, spend, history)
```

Stop conditions: answer, error, cancelled (Cancel / kill switch / 15-min
unanswered question), spend cap, max turns.

### 6.1 Approval card outcomes

| Button | Effect |
|--------|--------|
| Allow | reply "yes" → click proceeds |
| Don't | reply "no" → tool error "owner declined" → model asks or stops |
| Always allow on this site | saves `siteRules[host]="allow"` + Allow |
| Never on this site | saves `siteRules[host]="never"` + Don't |
| (question) Send | free-text reply returned to the model as `Owner replied: …` |

### 6.2 Where things are written

| Data | Writer | Location |
|------|--------|----------|
| Settings, history, spend | Overlay (single writer), settings/tasks windows for their own fields | localStorage `pocketpet` |
| Keys | `agent_set_key` | Credential Manager `PocketPet/<provider>` |
| Memory | `remember` tool, Memory tab | `%LOCALAPPDATA%\PocketPet\memory.md` |
| Task logs | `emit()` in agent.rs | `%LOCALAPPDATA%\PocketPet\tasks\<id>.log` |
| Crashes | panic hook | `%LOCALAPPDATA%\PocketPet\logs\panic-<ts>.log` |
| Browser profile | Chromium | `%LOCALAPPDATA%\PocketPet\browser\` |

## 7. Voice

- **Windows engine**: 🎤 or Ctrl+Alt+V → `windows_listen` (OS listens until a pause) → text appended to the task box.
- **Whisper engine**: hold 🎤 (or toggle with Ctrl+Alt+V) → MediaRecorder webm → `agent_transcribe` → Groq/OpenAI Whisper → text.
- Read-aloud: answers and approval questions spoken with the pet's pitch/rate when enabled.

## 8. Schedules

Overlay checks every 30 s: enabled schedule, matching day, within 10 min after
its time, not run today, no task running → `agent_run` with id `sched-…` →
answer narrated + toast + history.

## 9. Updates

Daily (or Settings › Backup › Check): `GET releases/latest` → compare tag with
`CARGO_PKG_VERSION` → pet mentions it → **Download & install** fetches the
`-setup.exe` asset to `%TEMP%`, launches it, exits the app.
