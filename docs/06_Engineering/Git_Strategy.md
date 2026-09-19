# Git Strategy

- `main` is releasable; CI builds all packages (Windows NSIS, macOS aarch64 + x64 DMG, Linux AppImage + deb) on every push.
- Feature work on short-lived branches `feat/<topic>`, `fix/<topic>`; squash or rebase-merge into `main`.
- Tags `vMAJOR.MINOR.PATCH` create GitHub Releases with every package attached; the app's update check and the download page (https://pocketpet-web.vercel.app/) read the latest release. Bump `version` in `src-tauri/tauri.conf.json` and `Cargo.toml` before tagging — asset names come from it.
- The website lives in its own repo, [Pocketpet-web](https://github.com/vigneshcj001/Pocketpet-web), deployed by Vercel on push to `main`.
- Version lives in `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json` (keep in sync; bump both in the release commit).
- No binaries in the repo (`*.exe`, `*.dmg`, `*.AppImage`, `*.deb` ignored); artifacts come from CI/Releases.
- Line endings: repo is LF; Windows checkouts may show CRLF warnings — harmless. Consider `.gitattributes` `* text=auto eol=lf`.
- Secrets: never commit keys; `.gitignore` covers `*.key`; keys live in the OS keychain.
- Parallel sessions: commit small and often; `git status` before starting; if another session touched the tree, read its diff before building on it.
