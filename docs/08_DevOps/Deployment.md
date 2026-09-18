# Deployment

- Artifact: `PocketPet_<version>_x64-setup.exe` (NSIS, per-user, no admin).
- Install: run the setup (or `/S` silent). Installs to `%LOCALAPPDATA%\PocketPet`, Start Menu shortcut, uninstaller, upgrade in place.
- First run: WebView2 present on Win11; on Win10 the NSIS bundle downloads the Evergreen runtime if missing.
- Updates: in-app check (daily / manual) → GitHub Releases latest → download `-setup.exe` → launch → app exits → installer upgrades → relaunch from Start Menu.
- Data survives upgrades (localStorage in WebView2 profile keyed by app identifier `com.vigneshcj001.pocketpet`, files under `%LOCALAPPDATA%\PocketPet`).
- Uninstall: Settings › Apps or the uninstaller; leaves user data and Credential Manager entries (remove keys from the Tasks window first if desired).
