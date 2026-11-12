# Test Plan

| Level | What | How | When |
|-------|------|-----|------|
| Unit (Rust) | gates, keyboard-submit policy, cancellation, URL/host rules, page total, HTML→text, URL codec, hotkey parsing, fullscreen geometry, version compare, data paths | `cargo test --lib` | every commit, CI |
| Unit (JS) | settings normalisation/migration, quiet hours, hunger, placement, milestones, presets, narration, update state, platform wording, bundle targets, script line endings, DOM ids exist | `npm test` (= `node scripts/run-tests.mjs`, every `tests/*.test.mjs`) | every commit, CI |
| Release consistency | versions in Cargo.toml / Cargo.lock / tauri.conf.json and the tag agree | `npm run validate` | every commit, CI |
| Integration (offline) | agent loop with a fake OpenAI-compatible server (tool call → result → answer) | node fake server + CDP driver | before release |
| E2E (live) | `tests/agent-eval.mjs` against Gemini and one more provider | manual, costs money | before release, after prompt/tool changes |
| Manual | installer, tray, hotkeys, focus mode, breaks, games, voice, update | checklist in `Acceptance_Criteria.md` | before release |
| Manual (macOS / Linux) | DMG / AppImage / .deb / .rpm launch, Accessibility prompt, hotkeys, keychain, greyed-out window tricks, update asset choice; Linux on X11, on GNOME/KDE Wayland (XWayland) and with NVIDIA | `Acceptance_Criteria.md` › Platform | before release |
| Cross-compile check | `cargo check --target aarch64-apple-darwin` when a Mac or clang toolchain is available; otherwise CI is the first compile | — | every PR touching `src-tauri` |
| Security | gate bypass attempts, secret fields, injection pages | `Security_Testing.md` | before release |
| Performance | idle CPU, frame rate, task latency | `Performance_Testing.md` | before release |

Entry criteria: CI green. Exit criteria: acceptance criteria met, eval ≥ 90 %, zero gate bypasses, no open P1 bugs.
