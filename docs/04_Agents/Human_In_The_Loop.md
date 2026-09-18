# Human in the Loop

## Interaction points

| Moment | UI | Options | Default if silent |
|--------|----|---------|-------------------|
| Sensitive click / URL / off-list site | Approval card (Tasks) + pet says "need your okay" | Allow · Don't · Always allow on site · Never on site | task ends after 15 min |
| Model question (`ask_user`) | Question card | free-text reply · "done" | task ends after 15 min |
| Login / CAPTCHA / OTP / card | Question card; user acts in the pet's browser | reply "done" | same |
| Any time | Pause / Resume | take over in the browser, then resume | — |
| Any time | Cancel · Stop all (Ctrl+Alt+X) | — | — |

## Guarantees
- The agent cannot click a gated element until the oneshot reply arrives.
- "Always allow" is per domain, visible and revocable under Limits & sites.
- Purchase cap overrides even an Allow.
- Secrets are never typed by the agent under any setting.

## UX rules
- The card names the exact element text and host ("About to click "Place order" on amazon.in. Total on the page: 548.00. Allow?").
- The pet narrates and (optionally) speaks the question so the user notices even with the window behind.
- Approval history is in the task log.
