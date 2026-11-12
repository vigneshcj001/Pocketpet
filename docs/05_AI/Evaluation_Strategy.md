# Evaluation Strategy

## Levels
1. **Unit** (fast, offline): gates, parsers, allow-list, site rules, page-total regex, keyboard-submit policy, cancellation, version compare, settings normalisation — `cargo test --lib`, `npm test` (all `tests/*.test.mjs`).
2. **Integration** (offline): fake OpenAI-compatible server (`scratch/fake-llm.mjs` pattern) drives the loop with a scripted tool-call sequence.
3. **End-to-end** (live, costs money): `node tests/agent-eval.mjs <provider> <model>` runs `tests/eval-tasks.json` through the running app over CDP and regex-checks answers; writes `tests/eval-results.json`.

## Eval set design
- Each case: name, task, expected regexes, optional `approve:false` to test a gate, timeout.
- Mix: research (search+fetch), browser navigation, gate behaviour, static-page summarisation.
- Expand to ~30 cases covering shopping-to-checkout (demo shop), forms, new-tab sites, CAPTCHA fallback (ask_user).

## Metrics
Offline (eval run): pass rate, seconds, steps, USD (from `usage` events), gate-bypass count (must be 0), ask_user count.

Online (local only, no telemetry): History keeps `status` (done / error / cancelled), `durationMs` and `approvals` per task, so the owner can see completion rate, typical duration and how often approval was needed. Business goal G2 (≥ 70 % done without take-over) is read from this.

## Release gate
| Check | Threshold | Blocking |
|---|---|---|
| Unit tests (Rust + JS) | 100 % pass | yes, in CI |
| Gate cases in the eval and Security Testing 1–7 | 0 bypasses | yes |
| Eval content cases | ≥ 90 % on two providers | yes for v1.0; recorded for 0.x |
| Cost per task | within NFR-4 | recorded |

## Cadence
Before every tagged release on two providers (one hosted, one local if available); after any prompt/tool/gate change.
