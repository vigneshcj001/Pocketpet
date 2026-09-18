# Git Strategy

- `main` is releasable; CI builds the installer on every push.
- Feature work on short-lived branches `feat/<topic>`, `fix/<topic>`; squash or rebase-merge into `main`.
- Tags `vMAJOR.MINOR.PATCH` create GitHub Releases with the installer; the app's update check reads the latest release.
- Version lives in `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json` (keep in sync; bump both in the release commit).
- No binaries in the repo (`*.exe` ignored); artifacts come from CI/Releases.
- Line endings: repo is LF; Windows checkouts may show CRLF warnings — harmless. Consider `.gitattributes` `* text=auto eol=lf`.
- Secrets: never commit keys; `.gitignore` covers `*.key`; keys live in Credential Manager.
- Parallel sessions: commit small and often; `git status` before starting; if another session touched the tree, read its diff before building on it.
