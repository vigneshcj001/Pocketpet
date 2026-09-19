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
