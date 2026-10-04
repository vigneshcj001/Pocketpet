//! macOS and Linux versions of the platform modules. Same function names as
//! the Win32 ones so `lib.rs` compiles unchanged; what cannot be done without
//! Win32 (seeing other apps' windows, pressing their caption buttons, offline
//! dictation) returns "nothing here" and the frontend copes.

/// Cursor, screen and (mostly absent) window access.
pub mod win {
    pub use crate::geom::{Rect, WindowInfo};
    use std::sync::Mutex;

    /// Last cursor position seen by the cursor thread. `device_query` holds an
    /// X display / no Send, so the poller owns it and publishes here.
    static CURSOR: Mutex<(i32, i32)> = Mutex::new((0, 0));

    pub fn cursor_pos() -> (i32, i32) {
        CURSOR.lock().map(|c| *c).unwrap_or((0, 0))
    }

    /// Called by the cursor thread with the freshly read position.
    pub fn publish_cursor(x: i32, y: i32) {
        if let Ok(mut c) = CURSOR.lock() {
            *c = (x, y);
        }
    }

    /// Read the pointer straight from the OS, in the OS's own units: pixels on
    /// X11, points on macOS (the caller scales those).
    pub fn read_cursor(state: &device_query::DeviceState) -> (i32, i32) {
        use device_query::DeviceQuery;
        state.get_mouse().coords
    }

    /// Bounding box of every monitor. Without an app handle we cannot ask
    /// Tauri, so `lib.rs` passes the monitors it already has; this is only the
    /// fallback for the default (single 1920×1080) case.
    pub fn virtual_screen() -> Rect {
        Rect { x: 0, y: 0, w: 1920, h: 1080 }
    }

    pub fn frame_bounds_raw(_hwnd: isize) -> Option<Rect> {
        None
    }
    pub fn list_windows() -> Vec<WindowInfo> {
        Vec::new()
    }
    pub fn foreground_window() -> Option<WindowInfo> {
        None
    }
    pub fn raw_foreground() -> isize {
        0
    }
    pub fn root_window(raw: isize) -> isize {
        raw
    }
    pub fn is_fullscreen(_raw: isize) -> bool {
        false
    }
    pub fn window_for_pid(_pid: u32) -> Option<WindowInfo> {
        None
    }
    pub fn window_by_hwnd(_hwnd: isize) -> Option<WindowInfo> {
        None
    }

    pub const SC_MINIMIZE: usize = 0xF020;
    pub const SC_MAXIMIZE: usize = 0xF030;
    pub const SC_CLOSE: usize = 0xF060;
    pub const SC_RESTORE: usize = 0xF120;

    pub fn post_syscommand(_hwnd_raw: isize, _command: usize) -> bool {
        false
    }
    pub fn real_click_at(_x: i32, _y: i32, _restore: bool) -> bool {
        false
    }

    /// Linux: sysfs. macOS: `pmset`. Unknown → mains.
    pub fn on_battery() -> bool {
        #[cfg(target_os = "linux")]
        {
            if let Ok(rd) = std::fs::read_dir("/sys/class/power_supply") {
                for entry in rd.flatten() {
                    let status = std::fs::read_to_string(entry.path().join("status")).unwrap_or_default();
                    if status.trim() == "Discharging" {
                        return true;
                    }
                }
            }
            false
        }
        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("pmset")
                .args(["-g", "batt"])
                .output()
                .ok()
                .map(|o| String::from_utf8_lossy(&o.stdout).contains("Battery Power"))
                .unwrap_or(false)
        }
        #[cfg(not(any(target_os = "linux", target_os = "macos")))]
        {
            false
        }
    }
}

/// No caption-button discovery outside Windows.
pub mod titlebar {
    pub use crate::geom::CaptionButtons;
    use crate::geom::Rect;

    pub fn caption_buttons(_hwnd_raw: isize, _window: Rect) -> CaptionButtons {
        CaptionButtons { minimize: None, maximize: None, close: None, source: "none" }
    }
}

/// File dialogs, clipboard, updates.
pub mod extras {
    use base64::Engine;

    /// Biggest image we will turn into a pet (settings shrinks it afterwards).
    const MAX_IMAGE_BYTES: u64 = 15_000_000;
    const MAX_BACKUP_BYTES: u64 = 40_000_000;

    fn read_image(path: &std::path::Path) -> Result<Option<String>, String> {
        let meta = std::fs::metadata(path).map_err(|e| e.to_string())?;
        if meta.len() > MAX_IMAGE_BYTES {
            return Err(format!("That image is {} KB; keep it under {} KB.", meta.len() / 1024, MAX_IMAGE_BYTES / 1024));
        }
        let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
        let mime = match path.extension().and_then(|s| s.to_str()).map(|s| s.to_ascii_lowercase()).as_deref() {
            Some("png") => "image/png",
            Some("gif") => "image/gif",
            Some("jpg") | Some("jpeg") => "image/jpeg",
            Some("webp") => "image/webp",
            _ => return Err("Unsupported image type.".into()),
        };
        let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
        Ok(Some(format!("data:{mime};base64,{b64}")))
    }

    /// Native "Open" dialog filtered to images. Async because macOS wants its
    /// dialogs driven from the main run loop, which `rfd` handles for us.
    pub async fn pick_image() -> Result<Option<String>, String> {
        let picked = rfd::AsyncFileDialog::new()
            .set_title("Choose a picture for your pet")
            .add_filter("Images", &["png", "gif", "jpg", "jpeg", "webp"])
            .pick_file()
            .await;
        match picked {
            Some(handle) => read_image(handle.path()),
            None => Ok(None),
        }
    }

    pub async fn save_backup(json: String) -> Result<Option<String>, String> {
        let name = format!("pocketpet-backup-{}.json", utc_stamp());
        let picked = rfd::AsyncFileDialog::new()
            .set_title("Save PocketPet backup")
            .add_filter("PocketPet backup", &["json"])
            .set_file_name(&name)
            .save_file()
            .await;
        let Some(handle) = picked else { return Ok(None) };
        let path = handle.path().to_path_buf();
        std::fs::write(&path, json).map_err(|e| e.to_string())?;
        Ok(Some(path.display().to_string()))
    }

    pub async fn load_backup() -> Result<Option<String>, String> {
        let picked = rfd::AsyncFileDialog::new()
            .set_title("Open PocketPet backup")
            .add_filter("PocketPet backup", &["json"])
            .add_filter("All files", &["*"])
            .pick_file()
            .await;
        let Some(handle) = picked else { return Ok(None) };
        let path = handle.path();
        let meta = std::fs::metadata(path).map_err(|e| e.to_string())?;
        if meta.len() > MAX_BACKUP_BYTES {
            return Err("That file is too large to be a PocketPet backup.".into());
        }
        std::fs::read_to_string(path).map(Some).map_err(|e| e.to_string())
    }

    /// YYYYMMDD-HHMM in UTC, from the epoch, without a date crate.
    fn utc_stamp() -> String {
        let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
        let days = (secs / 86_400) as i64;
        let (h, m) = ((secs % 86_400) / 3600, (secs % 3600) / 60);
        // Howard Hinnant's civil-from-days.
        let z = days + 719_468;
        let era = z.div_euclid(146_097);
        let doe = z.rem_euclid(146_097);
        let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
        let y = yoe + era * 400;
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        let mp = (5 * doy + 2) / 153;
        let d = doy - (153 * mp + 2) / 5 + 1;
        let mo = if mp < 10 { mp + 3 } else { mp - 9 };
        let y = if mo <= 2 { y + 1 } else { y };
        format!("{y:04}{mo:02}{d:02}-{h:02}{m:02}")
    }

    /// Plain text currently on the clipboard, if any.
    pub fn clipboard_text() -> Option<String> {
        arboard::Clipboard::new().ok()?.get_text().ok().filter(|t| !t.trim().is_empty())
    }

    // --- updates ---------------------------------------------------------------
    use sha2::{Digest, Sha256};

    const RELEASES_API: &str = "https://api.github.com/repos/vigneshcj001/Pocketpet/releases/latest";
    const RELEASE_DOWNLOADS: &str = "https://github.com/vigneshcj001/Pocketpet/releases/download/";

    #[derive(serde::Serialize)]
    pub struct UpdateInfo {
        pub current: String,
        pub latest: String,
        pub available: bool,
        pub url: String,
        pub sha256: String,
        pub notes: String,
    }

    fn release_digest(asset: &serde_json::Value) -> Option<String> {
        let digest = asset.get("digest")?.as_str()?.strip_prefix("sha256:")?;
        (digest.len() == 64 && digest.bytes().all(|byte| byte.is_ascii_hexdigit()))
            .then(|| digest.to_ascii_lowercase())
    }

    fn version_tuple(v: &str) -> (u64, u64, u64) {
        let mut it = v.trim().trim_start_matches('v').split(|c: char| !c.is_ascii_digit()).filter(|s| !s.is_empty()).map(|s| s.parse().unwrap_or(0));
        (it.next().unwrap_or(0), it.next().unwrap_or(0), it.next().unwrap_or(0))
    }

    /// Which release asset is ours on this platform.
    fn asset_matches(url: &str) -> bool {
        #[cfg(target_os = "macos")]
        {
            let arch = if cfg!(target_arch = "aarch64") { "aarch64" } else { "x64" };
            url.ends_with(".dmg") && url.contains(arch)
        }
        #[cfg(target_os = "linux")]
        {
            url.ends_with(".AppImage")
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
        {
            let _ = url;
            false
        }
    }

    pub async fn check_update() -> Result<UpdateInfo, String> {
        let current = env!("CARGO_PKG_VERSION").to_string();
        let client = reqwest::Client::builder().user_agent("PocketPet").build().map_err(|e| e.to_string())?;
        let resp = client.get(RELEASES_API).send().await.map_err(|e| e.to_string())?;
        if resp.status().as_u16() == 404 {
            return Ok(UpdateInfo { current: current.clone(), latest: current, available: false, url: String::new(), sha256: String::new(), notes: "No releases published yet.".into() });
        }
        let v: serde_json::Value = resp.error_for_status().map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())?;
        let latest = v.get("tag_name").and_then(|t| t.as_str()).unwrap_or("").to_string();
        let asset = v
            .get("assets")
            .and_then(|a| a.as_array())
            .into_iter()
            .flatten()
            .find(|a| a.get("browser_download_url").and_then(|u| u.as_str()).is_some_and(asset_matches));
        let url = asset.and_then(|a| a.get("browser_download_url").and_then(|u| u.as_str())).unwrap_or("").to_string();
        let sha256 = asset.and_then(release_digest).unwrap_or_default();
        let notes = v.get("body").and_then(|b| b.as_str()).unwrap_or("").chars().take(1500).collect();
        let newer = version_tuple(&latest) > version_tuple(&current);
        let available = newer && !url.is_empty() && !sha256.is_empty();
        let notes = if newer && sha256.is_empty() { "Release has no SHA-256 digest. Download it manually from GitHub Releases.".into() } else { notes };
        Ok(UpdateInfo { current, latest, available, url, sha256, notes })
    }

    #[derive(Clone, serde::Serialize)]
    struct UpdateProgress {
        downloaded: u64,
        total: Option<u64>,
        done: bool,
    }

    /// Download the package to the temp dir. The caller opens it: the .dmg
    /// mounts, the AppImage's folder is revealed; replacing the running app
    /// is left to the user on these platforms.
    pub async fn download_update(url: &str, expected_sha256: &str, app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
        use std::io::Write;
        use tauri::Emitter;
        // Only our own release assets; GitHub redirects these to its CDN itself.
        if !url.starts_with(RELEASE_DOWNLOADS) || url.contains("..") || url.to_ascii_lowercase().contains("%2e") || !asset_matches(url) {
            return Err("Refusing to download an update from outside GitHub.".into());
        }
        if expected_sha256.len() != 64 || !expected_sha256.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err("Release package has no valid SHA-256 digest.".into());
        }
        let client = reqwest::Client::builder().user_agent("PocketPet")
            .connect_timeout(std::time::Duration::from_secs(20))
            .timeout(std::time::Duration::from_secs(600))
            .build().map_err(|e| e.to_string())?;
        let mut response = client.get(url).send().await.map_err(|e| e.to_string())?
            .error_for_status().map_err(|e| e.to_string())?;
        let total = response.content_length();
        let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?.as_nanos();
        let extension = if cfg!(target_os = "macos") { "dmg" } else { "AppImage" };
        let path = std::env::temp_dir().join(format!("PocketPet-update-{stamp}.{extension}"));
        let partial = path.with_extension("part");
        let result = async {
            let mut file = std::fs::File::create(&partial).map_err(|e| e.to_string())?;
            let mut downloaded = 0_u64;
            let mut hasher = Sha256::new();
            let mut reported = std::time::Instant::now();
            let _ = app.emit("pet://update-progress", UpdateProgress { downloaded, total, done: false });
            while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
                file.write_all(&chunk).map_err(|e| e.to_string())?;
                hasher.update(&chunk);
                downloaded += chunk.len() as u64;
                if reported.elapsed() >= std::time::Duration::from_millis(100) {
                    let _ = app.emit("pet://update-progress", UpdateProgress { downloaded, total, done: false });
                    reported = std::time::Instant::now();
                }
            }
            if downloaded < 100_000 {
                return Err("Downloaded file is too small to be the update.".to_string());
            }
            if total.is_some_and(|expected| downloaded != expected) {
                return Err("The update download was incomplete. Please try again.".to_string());
            }
            if format!("{:x}", hasher.finalize()) != expected_sha256.to_ascii_lowercase() {
                return Err("Update SHA-256 digest did not match GitHub release metadata.".into());
            }
            file.sync_all().map_err(|e| e.to_string())?;
            drop(file);
            std::fs::rename(&partial, &path).map_err(|e| e.to_string())?;
            let _ = app.emit("pet://update-progress", UpdateProgress { downloaded, total, done: true });
            Ok(path.clone())
        }.await;
        if result.is_err() { let _ = std::fs::remove_file(&partial); }
        result
    }
}

/// "Run at startup" via `auto-launch` (LaunchAgent on macOS, an XDG autostart
/// .desktop file on Linux) and global hotkeys via the Tauri plugin.
pub mod startup {
    pub use crate::actions::{HotkeyAction, HOTKEY_LABEL};
    use std::sync::{Mutex, OnceLock};
    use tauri::AppHandle;
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

    fn launcher() -> Option<auto_launch::AutoLaunch> {
        let exe = std::env::current_exe().ok()?;
        // LaunchAgent executes ProgramArguments[0], so macOS needs the binary,
        // not the .app directory. AppImage's current_exe is a temporary mount.
        #[cfg(target_os = "linux")]
        let exe = std::env::var_os("APPIMAGE")
            .map(std::path::PathBuf::from)
            .filter(|p| p.is_absolute() && p.is_file())
            .unwrap_or(exe);
        auto_launch::AutoLaunchBuilder::new()
            .set_app_name("PocketPet")
            .set_app_path(&exe.display().to_string())
            .set_use_launch_agent(true)
            .build()
            .ok()
    }

    pub fn autostart_enabled() -> bool {
        launcher().and_then(|l| l.is_enabled().ok()).unwrap_or(false)
    }

    pub fn set_autostart(enabled: bool) -> bool {
        let Some(l) = launcher() else { return false };
        if enabled { l.enable().is_ok() } else { l.disable().is_ok() }
    }

    // --- hotkeys ---------------------------------------------------------------

    /// A parsed combination, kept as the plugin's own type.
    #[derive(Clone, Debug, PartialEq)]
    pub struct Combo(pub Shortcut);

    /// Parse "Ctrl+Alt+P", "Ctrl+Shift+F5", "Win+Alt+1" into a plugin shortcut.
    /// Returns `None` when the text names no key or no modifier — a bare letter
    /// must never become a global hotkey, it would eat the user's typing.
    pub fn parse_combo(text: &str) -> Option<Combo> {
        let mut mods: Vec<&str> = Vec::new();
        let mut key: Option<String> = None;
        for part in text.split('+').map(|p| p.trim()) {
            if part.is_empty() { return None; }
            let lower = part.to_ascii_lowercase();
            match lower.as_str() {
                "ctrl" | "control" => mods.push("ctrl"),
                "alt" | "option" => mods.push("alt"),
                "shift" => mods.push("shift"),
                "win" | "super" | "meta" | "cmd" | "command" => mods.push("super"),
                k => {
                    if key.is_some() {
                        return None;
                    }
                    let code = match k {
                        k if k.len() == 1 && k.as_bytes()[0].is_ascii_alphabetic() => format!("Key{}", k.to_ascii_uppercase()),
                        k if k.len() == 1 && k.as_bytes()[0].is_ascii_digit() => format!("Digit{k}"),
                        k if k.starts_with('f') && k[1..].parse::<u32>().map_or(false, |n| (1..=24).contains(&n)) => k.to_ascii_uppercase(),
                        "space" => "Space".into(),
                        "tab" => "Tab".into(),
                        "enter" | "return" => "Enter".into(),
                        "esc" | "escape" => "Escape".into(),
                        "home" => "Home".into(),
                        "end" => "End".into(),
                        "pageup" | "pgup" => "PageUp".into(),
                        "pagedown" | "pgdn" => "PageDown".into(),
                        "insert" | "ins" => "Insert".into(),
                        "delete" | "del" => "Delete".into(),
                        "up" => "ArrowUp".into(),
                        "down" => "ArrowDown".into(),
                        "left" => "ArrowLeft".into(),
                        "right" => "ArrowRight".into(),
                        _ => return None,
                    };
                    key = Some(code);
                }
            }
        }
        let key = key?;
        if mods.is_empty() {
            return None;
        }
        let text = format!("{}+{}", mods.join("+"), key);
        text.parse::<Shortcut>().ok().map(Combo)
    }

    static APP: OnceLock<AppHandle> = OnceLock::new();
    static BOUND: Mutex<Vec<(HotkeyAction, Shortcut)>> = Mutex::new(Vec::new());
    static ON_PRESS: OnceLock<fn(&AppHandle, HotkeyAction)> = OnceLock::new();

    /// The plugin's handler: look the shortcut up and run its action.
    pub fn handle(app: &AppHandle, shortcut: &Shortcut, state: ShortcutState) {
        if state != ShortcutState::Pressed {
            return;
        }
        let action = BOUND.lock().ok().and_then(|b| b.iter().find(|(_, s)| s == shortcut).map(|(a, _)| *a));
        if let (Some(action), Some(cb)) = (action, ON_PRESS.get()) {
            cb(app, action);
        }
    }

    fn apply(bindings: Vec<(HotkeyAction, Combo)>) -> Vec<HotkeyAction> {
        let Some(app) = APP.get() else {
            return bindings.into_iter().map(|(action, _)| action).collect();
        };
        let gs = app.global_shortcut();
        if gs.unregister_all().is_err() {
            return bindings.into_iter().map(|(action, _)| action).collect();
        }
        let mut bound = Vec::new();
        let mut failed = Vec::new();
        for (action, Combo(shortcut)) in bindings {
            if gs.register(shortcut).is_ok() {
                bound.push((action, shortcut));
            } else {
                failed.push(action);
            }
        }
        if let Ok(mut b) = BOUND.lock() {
            *b = bound;
        }
        failed
    }

    /// Replace the whole binding set.
    pub fn set_hotkeys(bindings: Vec<(HotkeyAction, Combo)>) -> Vec<HotkeyAction> {
        apply(bindings)
    }

    /// No thread needed here: the plugin delivers presses on its own. Keeps
    /// the app handle and callback for later re-binds.
    pub fn spawn_hotkey_thread(app: AppHandle, initial: Vec<(HotkeyAction, Combo)>, on_press: fn(&AppHandle, HotkeyAction)) {
        let _ = APP.set(app);
        let _ = ON_PRESS.set(on_press);
        apply(initial);
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn parses_common_combos() {
            assert!(parse_combo("Ctrl+Alt+P").is_some());
            assert!(parse_combo("ctrl + shift + f5").is_some());
            assert!(parse_combo("Win+1").is_some());
            assert_eq!(parse_combo("P"), None, "no modifier: would eat typing");
            assert_eq!(parse_combo("Ctrl+"), None);
            assert_eq!(parse_combo(""), None);
            assert_eq!(parse_combo("Ctrl+A+B"), None);
            for text in ["Ctrl+invalid+P", "Ctrl+P+invalid", "Ctrl++P", "+Ctrl+P", "Ctrl+P+", "Ctrl+F25"] {
                assert_eq!(parse_combo(text), None, "accepted malformed shortcut {text}");
            }
        }
    }
}

/// API keys: the OS keychain via `keyring`, with a locked-down file as the
/// fallback when no secret service is running (headless Linux, some VMs).
pub mod secrets {
    use std::path::PathBuf;

    fn entry(provider_id: &str) -> Option<keyring::Entry> {
        keyring::Entry::new("PocketPet", provider_id).ok()
    }

    fn fallback_path(provider_id: &str) -> PathBuf {
        crate::paths::data_dir().join("keys").join(provider_id)
    }

    fn write_private(path: &std::path::Path, key: &str) -> Result<(), String> {
        use std::io::Write;
        use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
            std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o700))
                .map_err(|e| e.to_string())?;
        }
        // Unlink first so an existing symlink is never followed. create_new
        // fails safely if another file appears before we open it.
        match std::fs::remove_file(path) {
            Ok(()) => (),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
            Err(e) => return Err(e.to_string()),
        }
        let mut file = std::fs::OpenOptions::new().write(true).create_new(true)
            .mode(0o600).open(path).map_err(|e| e.to_string())?;
        file.write_all(key.as_bytes()).map_err(|e| e.to_string())
    }

    pub fn store_key(provider_id: &str, key: &str) -> Result<(), String> {
        if crate::agent::provider(provider_id).is_none() {
            return Err("Unknown provider.".into());
        }
        if let Some(e) = entry(provider_id) {
            if e.set_password(key).is_ok() {
                let _ = std::fs::remove_file(fallback_path(provider_id));
                return Ok(());
            }
        }
        write_private(&fallback_path(provider_id), key)
    }

    pub fn read_key(provider_id: &str) -> Option<String> {
        crate::agent::provider(provider_id)?;
        let from_ring = entry(provider_id).and_then(|e| e.get_password().ok());
        let key = from_ring.or_else(|| std::fs::read_to_string(fallback_path(provider_id)).ok())?;
        let key = key.trim().to_string();
        if key.is_empty() { None } else { Some(key) }
    }

    pub fn delete_key(provider_id: &str) -> bool {
        if crate::agent::provider(provider_id).is_none() {
            return false;
        }
        let ring = entry(provider_id).map(|e| e.delete_credential().is_ok()).unwrap_or(false);
        let file = std::fs::remove_file(fallback_path(provider_id)).is_ok();
        ring || file
    }
}
