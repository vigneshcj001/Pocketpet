# Memory Design

## Layers

| Layer | Store | Scope | Written by | Read by |
|-------|-------|-------|------------|---------|
| Working | `messages` in the loop | one task | agent | agent |
| Follow-up | `Tasks.last` (≤ 40 msgs, same wire) | until next task | agent | next task with "continue" |
| Long-term facts | `memory.md` ≤ 6 000 chars | forever | `remember` tool, Memory tab | every task's system prompt |
| Pet journal | localStorage `profiles.<pet>.journal` ≤ 40 | forever | overlay | dashboard, stats bubble |
| Task history | localStorage `tasks` ≤ 50 | forever | overlay | History tab, follow-up UI |
| Audit | `tasks/<id>.log` | forever | agent `emit` | user |

## Rules
- Memory is plain markdown bullets the user can read and edit; nothing hidden.
- The model is told to store durable preferences (address, diet, favourites),
  not transient task state.
- Full memory is injected verbatim; at the cap the tool asks the owner to tidy.
- Memory is included in backups? No — it is a file, not settings; export it by
  copying `memory.md`. (Candidate: add to backup v2.)
- Follow-up context is dropped when the provider wire changes (message
  formats differ) and trimmed so it never starts on a tool result.

## Privacy
- Memory never leaves the machine except inside the system prompt sent to the
  chosen provider for a task. "Forget everything" clears it.
