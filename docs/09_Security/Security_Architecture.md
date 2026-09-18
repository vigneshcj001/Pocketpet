# Security Architecture

## Trust boundaries
```
[User]──approves──►[Tasks window]──IPC──►[Rust agent]──HTTPS──►[Provider]
                                            │  CDP ws (localhost)
                                            ▼
                                     [Pet's Chromium profile]──►[Websites]
```
- Webviews are untrusted for secrets: no keys, CSP `default-src 'self'`, only the IPC origin allowed for `connect-src`.
- Rust holds keys (Credential Manager), makes all provider calls, and enforces all gates.
- The agent's browser runs under a separate profile; websites never see the user's own sessions.
- Website content is untrusted input to the model (data, not instructions).

## Controls
| Threat | Control |
|--------|---------|
| Key theft from settings/backups/logs | keys never serialised; diagnostics list names only |
| Unwanted purchase/login/send | code gates + human approval + purchase cap + site rules |
| Prompt injection from pages | framing as tool data, prompt rule, gates still apply |
| Malicious update | GitHub-only download origin; size sanity check |
| Runaway spend | per-turn accounting, daily cap, step cap |
| Clipboard/voice abuse | hotkeys are user-bound; clipboard text is truncated and only fills a text box |
| Local file access by the model | no filesystem tools exposed |

## Residual risks
Regex-based gates can miss unusual button labels; the user watches the browser
and holds the kill switch. Windows speech (online) sends audio to Microsoft when
enabled by the user; Whisper sends audio to the chosen provider.
