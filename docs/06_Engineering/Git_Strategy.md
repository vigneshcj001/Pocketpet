# Git Strategy

- `main` is releasable; CI builds all packages (Windows NSIS, macOS aarch64 + x64 DMG, Linux AppImage + deb + rpm) on every push.
- Feature work on short-lived branches (`feat/<topic>`, `fix/<topic>`, or a release topic such as `cross-platform-0.2.4`); squash or rebase-merge into `main`.
- Tags `vMAJOR.MINOR.PATCH` create GitHub Releases with every package attached; the app's update check and the download page (https://pocketpet-web.vercel.app/) read the latest release. Bump the version before tagging — asset names come from it.
- The website lives in its own repo, [Pocketpet-web](https://github.com/vigneshcj001/Pocketpet-web), deployed by Vercel on push to `main`.
- Version lives in `src-tauri/Cargo.toml`, the `pocketpet` entry of `src-tauri/Cargo.lock` and `src-tauri/tauri.conf.json`. Bump all three in the release commit; `npm run validate` (and CI) rejects a mismatch or a tag that differs.
- No binaries in the repo (`*.exe`, `*.dmg`, `*.AppImage`, `*.deb` ignored); artifacts come from CI/Releases.
- Executable scripts (`run.sh`, `build.sh`, `scripts/check-deps.sh`) are committed with mode 100755 (`git add --chmod=+x`).
- Line endings: repo is LF; Windows checkouts may show CRLF warnings — harmless. `.gitattributes` pins `*.sh` to LF so the scripts run on macOS/Linux even when committed from Windows.
- Secrets: never commit keys; `.gitignore` covers `*.key`; keys live in the OS keychain.
- Parallel sessions: commit small and often; `git status` before starting; if another session touched the tree, read its diff before building on it.
