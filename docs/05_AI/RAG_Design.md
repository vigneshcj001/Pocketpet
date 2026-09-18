# Retrieval Design

PocketPet does not run a vector store. Retrieval is live and tool-driven:

| Need | Mechanism | Limits |
|------|-----------|--------|
| Web facts | `web_search` (DuckDuckGo HTML) → `fetch_page` / `open_browser` | 8 hits; 14 k chars per page; 7 k chars page text in browser view |
| Claude | Anthropic server `web_search` / `web_fetch` | 8 uses each; 20 k tokens per fetch |
| Owner facts | `memory.md` injected whole | ≤ 6 000 chars |
| Prior task | follow-up transcript | ≤ 40 messages |
| Long outputs | digest model summarises with the task as query | keeps refs/URLs/prices |

Why no index: tasks are ad-hoc and time-sensitive; freshness beats recall;
the corpus (the live web) is not ours to embed. If local documents become a
feature, add a `search_files` tool over a small embedded index rather than
changing the loop.
