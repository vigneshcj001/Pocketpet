# CI/CD

Workflow: `.github/workflows/build.yml`. `permissions: contents: write` so the release step can upload with `GITHUB_TOKEN`.

**Jobs**

| Job | Runner | Bundles | Artifact |
|-----|--------|---------|----------|
| `test` | ubuntu-latest | — | `node --test tests/features.test.mjs` |
| `build / windows` | windows-latest | `nsis` | `PocketPet_<v>_x64-setup.exe` |
| `build / macos-aarch64` | macos-latest | `dmg` (`--target aarch64-apple-darwin`) | `PocketPet_<v>_aarch64.dmg` |
| `build / macos-x64` | macos-15-intel | `dmg` (`--target x86_64-apple-darwin`) | `PocketPet_<v>_x64.dmg` |
| `build / linux` | ubuntu-22.04 | `appimage,deb` | `PocketPet_<v>_amd64.AppImage`, `.deb` |

The linux job also installs `gstreamer1.0-plugins-{base,good,bad}`, `gstreamer1.0-libav` and `gstreamer1.0-pulseaudio`. `bundleMediaFramework` is on, so linuxdeploy copies those plugins into the AppImage; without them the bundle ships an empty `usr/lib/gstreamer-1.0` that `AppRun` still points `GST_PLUGIN_SYSTEM_PATH_1_0` at, and WebKit fails with `GStreamer element appsrc not found` ([tauri#15665](https://github.com/tauri-apps/tauri/issues/15665)).

Each build job: checkout → stable Rust (+ target) → `Swatinem/rust-cache` keyed per job → Linux apt deps (webkit2gtk-4.1, appindicator, X11/XTest, dbus) → `cargo test --lib` → `cargo install tauri-cli ^2` → macOS signing setup → `cargo tauri build --bundles …` → macOS `codesign --verify` → `upload-artifact` → on tag `v*`: `softprops/action-gh-release` attaches the package to the release with generated notes. `fail-fast: false`, so one OS failing does not block the others.

**Release flow:** bump `version` in `src-tauri/tauri.conf.json` + `Cargo.toml` → commit → `git tag vX.Y.Z` → `git push origin vX.Y.Z` → four assets appear on the release ~10–15 min later → the in-app update check and the download page (<https://pocketpet-web.vercel.app/>) pick them up with no further steps.

**Website CI:** [Pocketpet-web](https://github.com/vigneshcj001/Pocketpet-web) is built and deployed by Vercel on every push to `main` (`npm run build`, output `dist`).

Local equivalents: `run.ps1` (debug), `build-installer.ps1` (Windows installer, also installs `tauri-cli` once); on macOS/Linux `cargo tauri build --bundles dmg` / `appimage,deb`.

**macOS code signing.** A `.app` with no signature at all is reported by Gatekeeper as “is damaged and can’t be opened” once the download carries `com.apple.quarantine`, so the macOS jobs always sign. With no secrets set, the *Set up macOS code signing* step exports `APPLE_SIGNING_IDENTITY=-` and Tauri ad-hoc signs — free, no Apple account, clears the “damaged” verdict, but the build is not notarized so the first launch still needs right-click → Open or *Open Anyway*. Setting these repo secrets switches the same step to a real Developer ID and lets Tauri notarize and staple:

| Secret | Value |
|---|---|
| `APPLE_CERTIFICATE` | base64 of the Developer ID Application `.p12` (`base64 -i cert.p12`) |
| `APPLE_CERTIFICATE_PASSWORD` | the `.p12` export password |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Name (TEAMID)` |
| `APPLE_ID` | Apple ID used for notarization |
| `APPLE_PASSWORD` | app-specific password for that Apple ID |
| `APPLE_TEAM_ID` | 10-character team ID |

The step imports the `.p12` into a throwaway keychain under `$RUNNER_TEMP` and only exports the notarization variables when a certificate is present, so the ad-hoc path never triggers a notarization attempt.

Windows code signing: not configured (candidate: `SIGNTOOL` with a cert secret).

Branch protection (recommended): require the workflow to pass before merging to `main`.
