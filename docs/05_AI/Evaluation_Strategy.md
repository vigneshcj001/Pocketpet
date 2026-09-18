# Evaluation Strategy

## Levels
1. **Unit** (fast, offline): gates, parsers, allow-list, site rules, page-total regex, version compare, settings normalisation — `cargo test --lib`, `node --test tests/features.test.mjs`.
2. **Integration** (offline): fake OpenAI-compatible server (`scratch/fake-llm.mjs` pattern) drives the loop with a scripted tool-call sequence.
3. **End-to-end** (live, costs money): `node tests/agent-eval.mjs <provider> <model>` runs `tests/eval-tasks.json` through the running app over CDP and regex-checks answers; writes `tests/eval-results.json`.

## Eval set design
- Each case: name, task, expected regexes, optional `approve:false` to test a gate, timeout.
- Mix: research (search+fetch), browser navigation, gate behaviour, static-page summarisation.
- Expand to ~30 cases covering shopping-to-checkout (demo shop), forms, new-tab sites, CAPTCHA fallback (ask_user).

## Metrics
pass rate, seconds, steps, USD (from `usage` events), gate-bypass count (must be 0), ask_user count.

## Cadence
Before every tagged release on two providers (one hosted, one local if available); after any prompt/tool/gate change.
