# Tool Registry

Client tools (both wires) defined in `agent.rs::tool_specs`; executed in `run_tool_inner`.

| Tool | Schema | Side effect | Gate(s) | Returns |
|------|--------|-------------|---------|---------|
| web_search | {query} | none | — | JSON list ≤ 8 {title,url,snippet} |
| fetch_page | {url} | none | http(s) only | text ≤ 14 k |
| open_browser | {url} | launches/reuses browser, navigates | allow-list, sensitive URL, site rule | page view |
| read_page | — | none | — | page view (+ screenshot if thin) |
| click | {ref} | clicks element | sensitive click, purchase cap, site rule, allow-list after nav | page view |
| type_text | {ref, text, submit?} | types | secret field | page view |
| select_option | {ref, value} | sets select | — | confirmation text |
| press_key | {key} | key event | — | "pressed" |
| scroll | {direction} | scrolls | — | position |
| screenshot | — | none | — | "attached" + JPEG |
| wait | {seconds ≤ 10} | sleeps | — | "waited" |
| close_browser | — | closes browser | — | "closed" |
| ask_user | {question} | blocks for owner | 15-min timeout | owner's reply |
| remember | {fact} | appends memory.md | 6 000-char cap | "Remembered." |
| set_plan | {steps[]} | UI plan | — | ack |
| update_step | {index, status} | UI step | — | ack |

Claude-only server tools: `web_search_20260209` (max 8 uses), `web_fetch_20260209` (max 8, 20 k tokens).

Page view format:
```
URL: … TITLE: … SCROLL: y/max
INTERACTIVE ELEMENTS (use the [n] ref):
[1] link "Sign in" → host/path
[2] input(text) placeholder="Search…"
…
PAGE TEXT:
…(≤ 7 000 chars)
```

Adding a tool: `ToolSpec` (name, description, JSON schema with
`additionalProperties:false`), a match arm, a gate if it acts, a unit test.
