# Agent Registry

| ID | Name | Kind | Trigger | Owner code | Autonomy |
|----|------|------|---------|------------|----------|
| AG-1 | Task agent | LLM + tools | user task (text/voice), schedule | `src-tauri/src/agent.rs` | acts on the web; human approval at commitment points |
| AG-2 | Browser driver | deterministic | tool calls from AG-1 | `src-tauri/src/browser.rs` | none (executes) |
| AG-3 | Digester | LLM (cheap) | tool output > 7 000 chars | `agent.rs::digest` | none (summarises) |
| AG-4 | Narrator | rules | `pet://task` events | `src/main.js` | pet animation/speech only |
| AG-5 | Chaser / idle life / sleeper | rules | cursor, timers | `src/main.js` | pet movement |
| AG-6 | Hunger & chatter | rules | timers | `src/main.js` | bubble lines |
| AG-7 | Mischief | rules (opt-in) | 1–2.5 min | `src/main.js` | minimises windows (never closes) |
| AG-8 | Break coach | rules | breakMins timer | `src/main.js` | asks the user to rest |
| AG-9 | Focus guard | rules | env poll 2 s | `src/main.js` + `win.rs` | hides/quiets the pet |
| AG-10 | Companion | rules | frame loop | `src/main.js` | second pet movement |
| AG-11 | Scheduler | rules | 30-s tick | `src/main.js` | starts AG-1 tasks |
| AG-12 | Update nudge | rules | daily | `src/main.js` + `extras.rs` | bubble hint only |

Only AG-1 and AG-3 call a model. Only AG-1 (through AG-2) can act on the
world outside the pet, and every such action is gated.
