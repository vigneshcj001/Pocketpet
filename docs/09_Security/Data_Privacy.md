# Data Privacy

| Data | Stored | Sent | Retention | User control |
|------|--------|------|-----------|--------------|
| Provider keys | OS keychain (Credential Manager / Keychain / Secret Service) | to that provider only | until removed | Remove in Tasks › Providers |
| Task text & answers | localStorage history ≤ 50, task logs | to the chosen provider | until cleared | Clear history; delete log files |
| Page contents read by tools | in-memory, task log (summaries) | to the provider as tool results | — | allow-list limits sites |
| Screenshots | in-memory, shown in Tasks window | to the provider when attached | not stored | browser off |
| Memory (`memory.md`) | file | in every task's system prompt | until edited | Memory tab; Forget everything |
| Voice audio | not stored | Windows speech (Microsoft) or Whisper provider | — | choose engine; disable voice |
| Pet stats/journal | localStorage | never | — | Reset |
| Telemetry | none | none | — | — |

Backups exclude keys and memory. Diagnostics text includes version, provider
names with keys, and crash logs — review before sharing.
