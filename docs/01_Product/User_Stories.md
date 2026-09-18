# User Stories

Format: As a …, I want …, so that …. Priority: M (must), S (should), C (could).

## Pet

| ID | Story | Pri | Acceptance |
|----|-------|-----|------------|
| US-P1 | As a user, I want the pet to follow my cursor and sit on my windows, so that it feels alive. | M | Walks/runs after the cursor; lands on window top edges; never blocks clicks elsewhere. |
| US-P2 | As a user, I want to feed, play with and pet it, so that I have a relationship with it. | M | Feed/throw place items where I click; games start from the menu; counters and journal update. |
| US-P3 | As a user, I want to customise its name, colour, accessories and personality. | S | Changes apply live from Settings; persist across restarts. |
| US-P4 | As a user, I want a second pet. | C | Companion follows, can be fed and patted, has its own stats. |

## Wellbeing

| ID | Story | Pri | Acceptance |
|----|-------|-----|------------|
| US-W1 | As a user, I want a break reminder every N minutes with snooze. | M | Pet walks to centre and asks; right-click snoozes; countdown shown. |
| US-W2 | As a user, I want it to stay quiet during games/presentations and my work hours. | M | Fullscreen app or quiet hours → quiet or hidden; restores itself. |

## Task agent

| ID | Story | Pri | Acceptance |
|----|-------|-----|------------|
| US-A1 | As a user, I want to type an errand and get a concise answer with sources. | M | Answer under 250 words, URLs cited, streamed while written. |
| US-A2 | As a user, I want it to shop/book for me up to the payment step. | M | Opens its own browser, fills search/filters, stops with an Allow/Don't card at pay/book/login. |
| US-A3 | As a user, I want to approve every risky click, and set per-site rules. | M | Gate on sensitive clicks and URLs; "Always allow on site" / "Never" saved. |
| US-A4 | As a user, I never want it to type my passwords or card numbers. | M | Secret fields refused; it asks me to fill them in its window. |
| US-A5 | As a user, I want a cap on what it may spend (API and purchases). | M | Daily USD cap stops tasks; purchase cap refuses over-limit pay clicks. |
| US-A6 | As a user, I want to speak the task. | S | 🎤 / Ctrl+Alt+V fills the box via Windows speech or Whisper. |
| US-A7 | As a user, I want it to remember my address and preferences. | S | `remember` writes memory; visible/editable in the Memory tab. |
| US-A8 | As a user, I want scheduled errands (morning news). | S | Schedules tab; runs once a day in the window; toast + bubble. |
| US-A9 | As a user, I want to take over mid-task and resume. | S | Pause/Resume; I act in the browser; agent continues. |
| US-A10 | As a user, I want one key to stop everything. | M | Ctrl+Alt+X cancels tasks and closes the pet's browser. |
| US-A11 | As a tinkerer, I want to use my own provider/model, including local ones. | M | Claude/OpenAI/Groq/Gemini/DeepSeek/Ollama/custom; model list fetched; keys in Credential Manager. |
| US-A12 | As a user, I want a log of what it did. | S | Per-task log file; History › Log opens it. |

## Platform

| ID | Story | Pri | Acceptance |
|----|-------|-----|------------|
| US-X1 | As a user, I want an installer and updates. | M | NSIS per-user installer; update check finds GitHub releases; download & install. |
| US-X2 | As a user, I want backup/restore. | S | Export/import JSON without keys. |
| US-X3 | As a user, I want hotkeys I can change. | S | All bindings editable; conflicts reported. |
