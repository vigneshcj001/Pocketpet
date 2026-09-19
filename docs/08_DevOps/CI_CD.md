# CI/CD

Workflow: `.github/workflows/build.yml`. `permissions: contents: write` so the release step can upload with `GITHUB_TOKEN`.

**Jobs**

| Job | Runner | Bundles | Artifact |
|-----|--------|---------|----------|
| `test` | ubuntu-latest | — | `node --test tests/features.test.mjs` |
| `build / windows` | windows-latest | `nsis` | `PocketPet_<v>_x64-setup.exe` |
| `build / macos-aarch64` | macos-latest | `dmg` (`--target aarch64-apple-darwin`) | `PocketPet_<v>_aarch64.dmg` |
| `build / macos-x64` | macos-13 | `dmg` (`--target x86_64-apple-darwin`) | `PocketPet_<v>_x64.dmg` |
| `build / linux` | ubuntu-22.04 | `appimage,deb` | `PocketPet_<v>_amd64.AppImage`, `.deb` |

Each build job: checkout → stable Rust (+ target) → `Swatinem/rust-cache` keyed per job → Linux apt deps (webkit2gtk-4.1, appindicator, X11/XTest, dbus) → `cargo test --lib` → `cargo install tauri-cli ^2` → `cargo tauri build --bundles …` → `upload-artifact` → on tag `v*`: `softprops/action-gh-release` attaches the package to the release with generated notes. `fail-fast: false`, so one OS failing does not block the others.

**Release flow:** bump `version` in `src-tauri/tauri.conf.json` + `Cargo.toml` → commit → `git tag vX.Y.Z` → `git push origin vX.Y.Z` → four assets appear on the release ~10–15 min later → the in-app update check and the download page (<https://pocketpet-web.vercel.app/>) pick them up with no further steps.

**Website CI:** [Pocketpet-web](https://github.com/vigneshcj001/Pocketpet-web) is built and deployed by Vercel on every push to `main` (`npm run build`, output `dist`).

Local equivalents: `run.ps1` (debug), `build-installer.ps1` (Windows installer, also installs `tauri-cli` once); on macOS/Linux `cargo tauri build --bundles dmg` / `appimage,deb`.

Secrets: none required. Code signing: not configured (candidates: `SIGNTOOL` with a cert secret on Windows; `APPLE_CERTIFICATE` + notarytool on macOS).

Branch protection (recommended): require the workflow to pass before merging to `main`.
