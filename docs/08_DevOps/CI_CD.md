# CI/CD

Workflow: `.github/workflows/build.yml`. Builds use read-only repository access; the release job has `contents: write` so it can publish with `GITHUB_TOKEN`.

**Jobs**

| Job | Runner | Bundles | Artifact |
|-----|--------|---------|----------|
| `test` | ubuntu-latest | — | Version validation + `node --test tests/*.test.mjs` |
| `build / windows` | windows-latest | `nsis` | `PocketPet_<v>_x64-setup.exe` |
| `build / macos-aarch64` | macos-latest | `dmg` (`--target aarch64-apple-darwin`) | `PocketPet_<v>_aarch64.dmg` |
| `build / macos-x64` | macos-15-intel | `dmg` (`--target x86_64-apple-darwin`) | `PocketPet_<v>_x64.dmg` |
| `build / linux` | ubuntu-22.04 | `appimage,deb` | `PocketPet_<v>_amd64.AppImage`, `.deb` |
| `release` (tags only) | ubuntu-latest | — | All five packages published together after every build succeeds |

The linux job also installs `gstreamer1.0-plugins-{base,good,bad}`, `gstreamer1.0-libav` and `gstreamer1.0-pulseaudio`. `bundleMediaFramework` is on, so linuxdeploy copies those plugins into the AppImage; without them the bundle ships an empty `usr/lib/gstreamer-1.0` that `AppRun` still points `GST_PLUGIN_SYSTEM_PATH_1_0` at, and WebKit fails with `GStreamer element appsrc not found` ([tauri#15665](https://github.com/tauri-apps/tauri/issues/15665)).

Each build job: checkout → stable Rust (+ target) → `Swatinem/rust-cache` keyed per job → Linux apt deps (webkit2gtk-4.1, appindicator, X11/XTest, dbus) → `cargo test --lib` → `cargo install tauri-cli ^2` → macOS signing setup → `cargo tauri build --bundles …` → macOS `codesign --verify` → `upload-artifact`. `fail-fast: false` lets the other platform builds finish if one fails, but a failure blocks publishing. On a `v*` tag, the release job downloads every platform's artifacts, uploads them to a draft, and publishes only after all uploads succeed. The update feed therefore cannot point at a partially uploaded release.

**A source push does not update an installed app.** A push to `main` builds downloadable workflow artifacts, but the website and in-app updater use the latest published GitHub Release. The updater only offers a release whose version is greater than the installed version. Rebuilding or replacing `v0.1.0` cannot make an installed `0.1.0` offer an update.

**Release flow:** bump `version` in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and the `pocketpet` entry in `src-tauri/Cargo.lock` → run `node scripts/validate-release.mjs` and the tests → commit → create a new matching tag (for this release, `git tag v0.2.0`) → push the commit and tag (`git push origin main` then `git push origin v0.2.0`) → wait for every build and the release job to succeed → the website and in-app update check pick up the published release. CI rejects mismatched versions or tags before building. Keep existing published tags unchanged; each update needs a higher version.

For local development, run `./run.ps1` to build and launch the current checkout, or build and install a fresh installer. Reopening an older installed executable continues to run its embedded frontend even after newer source code has been pushed.

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
