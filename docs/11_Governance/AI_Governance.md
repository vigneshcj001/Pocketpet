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

## Responsible use

- **Disclosure.** The agent always acts as the pet, in a window the owner can
  see; it does not pose as the owner. Messages, posts and sign-ins need an
  explicit Allow.
- **No decisions about people.** PocketPet does not rank, profile or decide
  anything about individuals; it runs the owner's errands.
- **Third-party processing.** The owner picks the provider; the Data Privacy
  doc says what each task sends. Local models are a first-class option.
- **Accessibility.** Keyboard access, adjustable speech bubbles and read-aloud;
  a screen-reader audit is still open (AI System Design gap 7).
- **Open gaps** in the [AI System Design](../03_Architecture/AI_System_Design.md#5-gaps-and-follow-ups)
  are reviewed at every release.

## Change control
Changes to prompts, tools, gates or providers require: unit test (if gate), eval run, entry in `Model_Prompt_Versioning.md`, changelog line.

## Review cadence
Before each release: security test list, eval results, cost per task, the AI System Design checklist and its gaps, and the price table (`price_at`). Quarterly: revisit gate regexes against new sites.
