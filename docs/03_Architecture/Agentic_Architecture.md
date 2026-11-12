# Agentic Architecture

See [AI System Design](AI_System_Design.md) for the one-page overview and
design checklist.

## Pattern

Single tool-using agent (ReAct-style loop) with:
- **Planner-in-loop**: the model declares a plan (`set_plan`) and reports progress (`update_step`); no separate planner model.
- **Executor**: Rust `run_tool_inner` — every side effect passes through it.
- **Gatekeeper**: code checks before side effects (see `05_AI/Guardrails.md`).
- **Human-in-the-loop**: `ask`/`confirm` block the loop on a oneshot channel until the Tasks window answers.
- **Digester** (optional): a cheaper model condenses long tool outputs.
- **Narrator**: the overlay maps agent events to pet behaviour (not an LLM).
- **Dispatcher**: the Tasks window owns every run. The chat bar, hotkeys and
  schedules push task intents into a Rust queue (`PendingTaskIntents`); Tasks
  drains it once its listeners exist, so nothing is lost or run twice. A second
  task while one runs joins the persisted queue.

## Loop

```
messages = [system, (prior…), user]
for turn in 0..max_turns:
    if paused: wait; if cancelled: stop
    resp = stream(provider, messages, tools)         # SSE; retry non-stream once
    charge(usage)                                     # stop if over budget
    if resp has tool calls:
        for call: out = gate+execute(call); out = digest(out)
        append assistant turn + tool results (+ images)
    elif stop == pause_turn: append and continue      # Anthropic server tools
    else: return text
```

## State

| Store | Lifetime | Content |
|-------|----------|---------|
| `Ctx` | one task | cancel/pause flags, recent call signatures, spend, failures |
| `Tasks` (managed) | app | per-task flags, waiting answers, shared `Browser`, last conversation |
| `memory.md` | forever | owner facts |
| `tasks/<id>.log` | forever | audit trail |
| localStorage | forever | settings, history, spend, rules, schedules |

## Failure handling

| Failure | Handling |
|---------|----------|
| provider 4xx/5xx | error surfaced with provider message; task ends |
| stream broken | one non-streaming retry, unless part of the answer is already on screen (then the error is shown, to avoid duplicated text) |
| CDP timeout | one retry on click/navigate |
| element ref stale | tool error "call read_page again" |
| empty page view | screenshot attached |
| 2 tool errors in a row | screenshot + ask_user hint |
| 3 identical calls | loop-guard error |
| owner silent 15 min | task ends |
| kill switch | all tasks cancelled, browser closed |
| cancel during a provider call | the pending request is dropped (`until_cancelled`); a late success is never reported |
| provider down / rate-limited | task ends with the provider message; no automatic failover (gap 3 in AI System Design) |

## Extension points

Providers (`PROVIDERS`), tools (`tool_specs` + `run_tool_inner`), gates
(regexes + unit tests), narration (`pet://task` listener), schedules
(overlay tick).
