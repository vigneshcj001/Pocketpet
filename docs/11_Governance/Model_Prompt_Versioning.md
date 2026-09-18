# Model & Prompt Versioning

Prompts and tool definitions live in `src-tauri/src/agent.rs`; the git history is the version history. Record notable changes here.

| Date | Commit | Change | Eval impact |
|------|--------|--------|-------------|
| 2026-09-18 | 291a256 | Initial system prompt; web_search/fetch_page tools; Claude server tools | baseline (fake server + Gemini live) |
| 2026-09-18 | 59ba3a3 | Browser tools, gates language, ask_user/remember/set_plan/update_step | Gemini browser tasks pass |
| 2026-09-18 | 681c449 | Screenshot guidance softened ("when the text view is not enough"); digest system prompt added | streaming + digest verified |

Default models: claude-opus-5, gpt-4o-mini, llama-3.3-70b-versatile, gemini-3.6-flash (was 2.5-flash, retired), deepseek-chat, llama3.2.
