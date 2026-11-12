# Guardrails

All enforced in Rust (`agent.rs`) unless noted. Unit tests: `gates_catch_money_and_secrets`, `sensitive_urls_are_caught`, `allow_list_matches_subdomains_only`, `site_rules_prefer_the_most_specific_domain`, `page_total_finds_the_order_total`, `keyboard_submission_uses_the_click_policy_without_gating_search_or_typing`, `cancellation_interrupts_a_pending_request_and_cannot_report_success`.

| # | Guardrail | Where | Behaviour |
|---|-----------|-------|-----------|
| G1 | Sensitive click | `is_sensitive` regex on element text/href | approval required |
| G2 | Sensitive URL | `is_sensitive_url` on `open_browser` | approval required |
| G3 | Secret field | `is_secret_field` (type=password, autocomplete cc-*, labels) | refused; ask_user |
| G4 | Purchase cap | `page_total` vs `purchase_cap` on money clicks | refused, no override |
| G5 | Allow-list | `host_allowed` on open/after click | approval to leave |
| G6 | Site rules | `site_rule` allow/ask/never (most specific domain) | skip / ask / refuse |
| G7 | Spend cap | `charge` per turn | task stops |
| G8 | Step cap | `max_turns` | task stops |
| G9 | Loop guard | 3 identical tool calls | tool error |
| G10 | Answer timeout | 15 min on ask/confirm | task stops |
| G11 | Kill switch | hotkey/button | cancel all + close browser |
| G12 | Update integrity | update package only from this repo's GitHub release URLs, matching this OS/install type, SHA-256 equal to the release digest, size ≥ 100 KB and complete | refused otherwise |
| G13 | Memory cap | 6 000 chars | tool error |
| G14 | Prompt injection | prompt rule + tool-message framing + G1/G2 | human still needed for any commitment |
| G15 | Key exposure | keys only read in Rust; diagnostics list names only | — |
| G16 | Keyboard submission | Enter/submit in a form via `press_key` or `type_text{submit}` | same approval as clicking the submit control |
| G17 | Cancellation | Cancel/kill during a provider call | request dropped; no late "done" |
| G18 | Host-process isolation | browser and `xdg-open` launched with a clean environment | AppImage libraries never leak into the user's programs |

Not guaranteed: detecting every possible "pay" button on every site (regex-based, English-centric). Mitigation: allow-list + purchase cap + user watching the browser. Tracked as gap 5 in [AI System Design](../03_Architecture/AI_System_Design.md).
