# Model & Prompt Versioning

Prompts and tool definitions live in `src-tauri/src/agent.rs`; the git history is the version history. Record notable changes here.

| Date | Commit | Change | Eval impact |
|------|--------|--------|-------------|
| 2026-09-18 | 291a256 | Initial system prompt; web_search/fetch_page tools; Claude server tools | baseline (fake server + Gemini live) |
| 2026-09-18 | 59ba3a3 | Browser tools, gates language, ask_user/remember/set_plan/update_step | Gemini browser tasks pass |
| 2026-09-18 | 681c449 | Screenshot guidance softened ("when the text view is not enough"); digest system prompt added | streaming + digest verified |
| 2026-09-28 | bd876f2 | Keyboard submission follows the click approval policy; cancellation interrupts pending requests; secret values redacted from snapshots | unit tests added; no prompt text change |
| 2026-10-01 | f1428d1 | Anthropic thinking blocks echoed with signatures; no streaming retry once text is shown; unknown provider ids rejected for keys | no prompt text change |
| 2026-10-08 | cbf657b | Price table by date (`price_at`): Gemini 3.6–3.8 Flash introductory rates until 2027-01-01 | spend estimates only |
| 2026-11-12 | 61e58bf | No agent prompt/tool change; browser discovery (`POCKETPET_BROWSER`), Cmd/Super modifier in `press_key`, clean child environment | none expected |

Default models: claude-opus-5, gpt-4o-mini, llama-3.3-70b-versatile, gemini-3.6-flash (was 2.5-flash, retired), deepseek-chat, llama3.2.
