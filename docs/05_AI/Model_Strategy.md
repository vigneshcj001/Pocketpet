# Model Strategy

## Roles

| Role | Default | Alternatives | Notes |
|------|---------|--------------|-------|
| Main task model | user's choice per provider (claude-opus-5 / gpt-4o-mini / llama-3.3-70b-versatile / gemini-3.6-flash / deepseek-chat / llama3.2) | any listed by the provider | Claude runs with adaptive thinking, effort medium |
| Digest model | off | same-provider cheap model (gemini-3.5-flash-lite, gpt-4o-mini, claude-haiku-4-5, llama-3.1-8b) | condenses tool outputs > 7 k chars |
| Speech-to-text | Windows recogniser | whisper-large-v3-turbo (Groq), whisper-1 (OpenAI) | |
| Text-to-speech | Windows voices via speechSynthesis | — | per-pet pitch/rate |

## Selection guidance
- Research-only tasks: any flash/mini model is enough.
- Browser tasks: prefer a tool-calling-strong model (Claude Opus/Sonnet, GPT-4o, Gemini 3.6 flash). Local models need tool support (llama3.1, qwen2.5).
- Vision needed (screenshots): the main model must accept images; Ollama needs a vision model.

## Cost controls
Streaming; digest model; `max_turns`; daily USD cap with hard stop; per-turn usage → price table (`agent.rs::price`, list prices, approximate); local models are free.

## Provider quirks handled
- Gemini: models retired for new keys (default tracked); errors array-wrapped; `models/` prefix; `thought_signature` must be echoed on tool calls.
- Local servers: may reject `stream_options` → non-streaming retry.
- Anthropic: server web tools + `pause_turn`; forced tool choice not used.
