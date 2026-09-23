# Deployment

## Distribution

- **Download page:** <https://pocketpet-web.vercel.app/> — source in [Pocketpet-web](https://github.com/vigneshcj001/Pocketpet-web) (React + Tailwind on Vite, auto-deployed by Vercel on push to `main`). Detects the visitor's OS and links each button to the matching asset of the latest GitHub Release by file-name suffix (`-setup.exe`, `_aarch64.dmg`, `_x64.dmg`, `.AppImage`, `.deb`). No release yet → buttons open the Releases page.
- **Releases:** <https://github.com/vigneshcj001/Pocketpet/releases>. Pushing a `v*` tag runs `.github/workflows/build.yml`, which builds Windows NSIS, macOS aarch64 + x64 DMG, Linux AppImage + deb and attaches them to the release. Nothing on the website needs changing per release.

## Windows

- Artifact: `PocketPet_<version>_x64-setup.exe` (NSIS, per-user, no admin). Built by `build-installer.ps1` into `src-tauri/target/release/bundle/nsis/`; a copy may sit at the repo root for hand-off (ignored via `*.exe`).
- Install: run the setup (or `/S` silent). Installs to `%LOCALAPPDATA%\PocketPet`, Start Menu shortcut, uninstaller, upgrade in place.
- First run: WebView2 present on Win11; on Win10 the NSIS bundle downloads the Evergreen runtime if missing.
- Updates: in-app check (daily / manual) → GitHub Releases latest → download `-setup.exe` → launch → app exits → installer upgrades → relaunch from Start Menu.
- Data survives upgrades (localStorage in WebView2 profile keyed by app identifier `com.vigneshcj001.pocketpet`, files under `%LOCALAPPDATA%\PocketPet`).
- Uninstall: Settings › Apps or the uninstaller; leaves user data and Credential Manager entries (remove keys from the Tasks window first if desired).

## macOS

- Artifacts: `PocketPet_<version>_aarch64.dmg` (Apple Silicon) and `PocketPet_<version>_x64.dmg` (Intel).
- Signing: CI ad-hoc signs the bundle (`APPLE_SIGNING_IDENTITY=-`). A bundle with no signature at all is reported by Gatekeeper as “is damaged and can’t be opened” on Apple Silicon; the ad-hoc signature removes that. It is still not notarized, so the first launch needs right-click → Open, or System Settings → Privacy & Security → Open Anyway. For a build with no prompt at all, set the repo secrets `APPLE_CERTIFICATE` (base64 of a Developer ID Application `.p12`), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` (app-specific password) and `APPLE_TEAM_ID` — `build.yml` then imports the certificate and Tauri notarizes and staples.
- Builds released before ad-hoc signing: `xattr -cr /Applications/PocketPet.app` (`-r` matters — quarantine is set on the nested files too).
- Install: drag to Applications. No Dock icon (Accessory activation policy); the pet and a menu-bar icon appear. Overlay covers the main display only.
- Permissions: System Settings → Privacy & Security → Accessibility for global hotkeys.
- Updates: in-app check downloads the matching `.dmg` and opens it; replace the app in Applications.
- Data: `~/Library/Application Support/PocketPet/`; keys in Keychain (service `PocketPet`). Run at startup = LaunchAgent.
- Uninstall: delete the app; optionally the data folder, the Keychain items and `~/Library/LaunchAgents/com.vigneshcj001.pocketpet.plist`.

## Linux

- Artifacts: `PocketPet_<version>_amd64.AppImage` (any distro, `chmod +x` then run) and `PocketPet_<version>_amd64.deb` (Ubuntu 22.04+ / Debian 12+, depends on `libwebkit2gtk-4.1-0`, `libgtk-3-0`).
- Prefer the `.deb` on Debian/Ubuntu: it links the system WebKit and GStreamer, so it is immune to the AppImage bundling problems below.
- AppImage needs FUSE 2, absent on Ubuntu 24.04+ / Fedora 40+. On `dlopen(): error loading libfuse.so.2`, install `libfuse2t64` / `fuse-libs`, or run `./PocketPet_<version>_amd64.AppImage --appimage-extract-and-run`. The `.deb` needs no FUSE.
- AppImage media: `bundle.linux.appimage.bundleMediaFramework` is on, and CI installs `gstreamer1.0-plugins-{base,good,bad}`, `-libav` and `-pulseaudio` so linuxdeploy copies the plugins in. Tauri's `AppRun` exports `GST_PLUGIN_SYSTEM_PATH_1_0=$APPDIR/usr/lib/gstreamer-1.0` unconditionally, so an AppImage built without the flag searches an empty directory, WebKit reports `GStreamer element appsrc not found` and the webview never starts — host GStreamer packages cannot rescue it, the override hides them ([tauri#15665](https://github.com/tauri-apps/tauri/issues/15665)). 0.1.0 AppImages have this defect; workaround in the README.
- `libgvfscommon.so: undefined symbol: g_task_set_static_name` on the AppImage is cosmetic: the bundle carries the builder's GLib 2.72 (Ubuntu 22.04) and the host's gvfs modules want GLib 2.76+.
- Needs X11 or XWayland: click-through and the cursor poller use X11; on pure Wayland the pet blocks clicks under it.
- Updates: in-app check downloads the `.AppImage`; replace the old file.
- Data: `$XDG_DATA_HOME/PocketPet/` (default `~/.local/share/PocketPet/`); keys in Secret Service (GNOME Keyring / KWallet) or `keys/` with mode `0600` when no daemon runs. Run at startup = `~/.config/autostart/pocketpet.desktop`.
- Uninstall: delete the AppImage or `apt remove pocketpet`; optionally the data folder and autostart entry.
