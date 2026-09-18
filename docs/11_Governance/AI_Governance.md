# AI Governance

## Principles
1. Human authority over money, identity and communication — always.
2. Transparency: every action logged; every prompt in code; every rule visible in the UI.
3. Minimal data: only what the task needs leaves the machine; nothing by default.
4. User choice of model and provider; no lock-in.
5. Reversibility: kill switch, pause, cancel; nothing autonomous is irreversible.

## Responsibilities
| Role | Responsibility |
|------|----------------|
| Maintainer | gates and tests, prompt versioning, release evals, incident triage |
| User | keys, caps, allow-list, approving actions, reviewing memory |

## Change control
Changes to prompts, tools, gates or providers require: unit test (if gate), eval run, entry in `Model_Prompt_Versioning.md`, changelog line.

## Review cadence
Before each release: security test list, eval results, cost per task. Quarterly: revisit gate regexes against new sites.
