# Test Plan

| Level | What | How | When |
|-------|------|-----|------|
| Unit (Rust) | gates, URL/host rules, page total, HTML→text, URL codec, hotkey parsing, fullscreen geometry, version compare | `cargo test --lib` | every commit, CI |
| Unit (JS) | settings normalisation/migration, quiet hours, hunger, placement, milestones, DOM ids exist | `node --test tests/features.test.mjs` | every commit, CI |
| Integration (offline) | agent loop with a fake OpenAI-compatible server (tool call → result → answer) | node fake server + CDP driver | before release |
| E2E (live) | `tests/agent-eval.mjs` against Gemini and one more provider | manual, costs money | before release, after prompt/tool changes |
| Manual | installer, tray, hotkeys, focus mode, breaks, games, voice, update | checklist in `Acceptance_Criteria.md` | before release |
| Security | gate bypass attempts, secret fields, injection pages | `Security_Testing.md` | before release |
| Performance | idle CPU, frame rate, task latency | `Performance_Testing.md` | before release |

Entry criteria: CI green. Exit criteria: acceptance criteria met, eval ≥ 90 %, zero gate bypasses, no open P1 bugs.
