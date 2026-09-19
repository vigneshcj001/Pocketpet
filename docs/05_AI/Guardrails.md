# Guardrails

All enforced in Rust (`agent.rs`) unless noted. Unit tests: `gates_catch_money_and_secrets`, `sensitive_urls_are_caught`, `allow_list_matches_subdomains_only`, `site_rules_prefer_the_most_specific_domain`, `page_total_finds_the_order_total`.

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
| G12 | Download origin | update package (any OS) only from GitHub hosts | refused otherwise |
| G13 | Memory cap | 6 000 chars | tool error |
| G14 | Prompt injection | prompt rule + tool-message framing + G1/G2 | human still needed for any commitment |
| G15 | Key exposure | keys only read in Rust; diagnostics list names only | — |

Not guaranteed: detecting every possible "pay" button on every site (regex-based). Mitigation: allow-list + purchase cap + user watching the browser.
