# Access Control

- Single-user desktop app; Windows user session is the security principal.
- Keychain entries are per OS user: Windows Credential Manager (LOCAL_MACHINE persist, user-scoped store), macOS login Keychain, Linux Secret Service collection; the Linux file fallback is `0600` under the user's data folder.
- No roles inside the app. "Admin" actions (reset all, forget memory, remove keys) require a confirm dialog.
- The agent's authority is bounded by: allow-list, site rules, purchase cap, spend cap, browser on/off, and the approval card. The user can narrow it at any time; changes apply to the next task (rules apply immediately on the next gate check).
- Hotkeys are global; the kill switch is intentionally always bound by default.
