# Rollback Plan

1. Identify the last good release tag (`vX.Y.Z`) on GitHub Releases.
2. Users: Windows — run that release's `-setup.exe`; it installs over the newer build (NSIS upgrade in place). macOS — open the older `.dmg` and replace the app. Linux — run the older `.AppImage` / `apt install ./older.deb`. Data is unaffected (schema is forward/backward tolerant via `normalizeSettings`; unknown keys are dropped, missing keys get defaults).
3. Maintainers: re-tag or publish a new patch release from the good commit so the in-app update check and the download page stop offering the bad build (delete or mark the bad release as pre-release — the website reads `releases/latest`, which skips pre-releases).
4. If a settings migration corrupted data: Settings › Backup › Import a prior export; or Reset all.
5. If the agent misbehaves: users can disable the browser (Limits & sites), set a $0.01 daily cap, or remove keys; the pet works without the agent.
6. Record the incident in `10_Operations/Incident_Runbook.md` format and add a regression test.
