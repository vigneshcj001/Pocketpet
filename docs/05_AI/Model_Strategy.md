# Model Strategy

## Roles

| Role | Default | Alternatives | Notes |
|------|---------|--------------|-------|
| Main task model | user's choice per provider (claude-opus-5 / gpt-4o-mini / llama-3.3-70b-versatile / gemini-3.6-flash / deepseek-chat / llama3.2) | any listed by the provider | Claude runs with adaptive thinking, effort medium |
| Digest model | off | same-provider cheap model (gemini-3.5-flash-lite, gpt-4o-mini, claude-haiku-4-5, llama-3.1-8b) | condenses tool outputs > 7 k chars |
| Speech-to-text | Windows recogniser | whisper-large-v3-turbo (Groq), whisper-1 (OpenAI) | |
| Text-to-speech | the webview's `speechSynthesis` voices (availability depends on the OS and webview; Linux WebKitGTK may have none) | — | per-pet pitch/rate |

## Selection guidance
- Research-only tasks: any flash/mini model is enough.
- Browser tasks: prefer a tool-calling-strong model (Claude Opus/Sonnet, GPT-4o, Gemini 3.6 flash). Local models need tool support (llama3.1, qwen2.5).
- Vision needed (screenshots): the main model must accept images; Ollama needs a vision model.

## Cost controls
Streaming; digest model; `max_turns`; daily USD cap with hard stop; per-turn usage → price table (`agent.rs::price_at`, list prices, approximate; Gemini 3.6–3.8 Flash introductory rates end 2027-01-01 and the table switches automatically); local models are free.

## Fallback and degradation
- Stream fails before any text → one non-streaming retry. After text was shown → error, so the answer is not duplicated.
- Provider error (4xx/5xx/429) → task ends with the provider's message. No automatic switch to another provider yet (AI System Design gap 3).
- Model retired → ↻ refreshes the live model list; the default per provider is tracked in `PROVIDERS`.
- No key / no network → the pet, games and reminders keep working; only tasks are unavailable.

## Provider quirks handled
- Gemini: models retired for new keys (default tracked); errors array-wrapped; `models/` prefix; `thought_signature` must be echoed on tool calls.
- Local servers: may reject `stream_options` → non-streaming retry.
- Anthropic: server web tools + `pause_turn`; forced tool choice not used.
