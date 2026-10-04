//! Odds and ends the frontend asks for: monitor layout and a native image picker.

use base64::Engine;
use windows::core::PWSTR;
use windows::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
use windows::Win32::Graphics::Gdi::{
    EnumDisplayMonitors, GetMonitorInfoW, HDC, HMONITOR, MONITORINFO,
};
use windows::Win32::UI::Controls::Dialogs::{
    GetOpenFileNameW, GetSaveFileNameW, OFN_FILEMUSTEXIST, OFN_NOCHANGEDIR, OFN_OVERWRITEPROMPT,
    OFN_PATHMUSTEXIST, OPENFILENAMEW,
};

use crate::geom::Rect;

/// Every monitor's bounds in physical pixels, so the pet can stand on the
/// bottom of *its* screen instead of the bottom of the tallest one.
pub fn monitor_layout() -> Vec<(Rect, Rect)> {
    unsafe extern "system" fn cb(mon: HMONITOR, _: HDC, _: *mut RECT, data: LPARAM) -> BOOL {
        let out = &mut *(data.0 as *mut Vec<(Rect, Rect)>);
        let mut info = MONITORINFO { cbSize: std::mem::size_of::<MONITORINFO>() as u32, ..Default::default() };
        if GetMonitorInfoW(mon, &mut info).as_bool() {
            out.push((Rect::from_win(info.rcMonitor), Rect::from_win(info.rcWork)));
        }
        BOOL::from(true)
    }
    let mut out: Vec<(Rect, Rect)> = Vec::new();
    unsafe {
        let _ = EnumDisplayMonitors(HDC::default(), None, Some(cb), LPARAM(&mut out as *mut _ as isize));
    }
    out
}

/// Biggest image we will turn into a pet. It ends up in localStorage as a data
/// URL, and that has a budget of a few MB.
// Settings crops and resizes the selected picture before storing it. Allow
// larger camera photos here; the saved pet remains small after conversion.
const MAX_IMAGE_BYTES: u64 = 15_000_000;

/// Native "Open" dialog filtered to images. Returns a `data:` URL, or `None`
/// if the user cancelled. `Err` carries a message worth showing.
pub fn pick_image() -> Result<Option<String>, String> {
    // Filter string is NUL-separated pairs, double-NUL terminated.
    let filter: Vec<u16> = "Images (*.png;*.gif;*.jpg;*.jpeg;*.webp)\0*.png;*.gif;*.jpg;*.jpeg;*.webp\0\0"
        .encode_utf16()
        .collect();
    let title: Vec<u16> = "Choose a picture for your pet\0".encode_utf16().collect();
    let mut file = vec![0u16; 4096];

    let mut ofn = OPENFILENAMEW {
        lStructSize: std::mem::size_of::<OPENFILENAMEW>() as u32,
        hwndOwner: HWND::default(),
        lpstrFilter: windows::core::PCWSTR(filter.as_ptr()),
        lpstrFile: PWSTR(file.as_mut_ptr()),
        nMaxFile: file.len() as u32,
        lpstrTitle: windows::core::PCWSTR(title.as_ptr()),
        Flags: OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR,
        ..Default::default()
    };

    let picked = unsafe { GetOpenFileNameW(&mut ofn) }.as_bool();
    if !picked {
        return Ok(None);
    }
    let len = file.iter().position(|&c| c == 0).unwrap_or(0);
    let path = String::from_utf16_lossy(&file[..len]);

    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > MAX_IMAGE_BYTES {
        return Err(format!(
            "That image is {} KB; keep it under {} KB.",
            meta.len() / 1024,
            MAX_IMAGE_BYTES / 1024
        ));
    }
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let mime = match path.rsplit('.').next().map(|s| s.to_ascii_lowercase()).as_deref() {
        Some("png") => "image/png",
        Some("gif") => "image/gif",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        _ => return Err("Unsupported image type.".into()),
    };
    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(Some(format!("data:{mime};base64,{b64}")))
}

// --- backups -----------------------------------------------------------------

/// Largest backup we will read back. Twelve custom pets at the image cap is
/// well under this; anything bigger is not one of ours.
const MAX_BACKUP_BYTES: u64 = 40_000_000;

fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
}

fn dialog_path(save: bool, title: &str, default_name: &str) -> Option<String> {
    // Filter string is NUL-separated pairs, double-NUL terminated.
    let filter: Vec<u16> = "PocketPet backup (*.json)\0*.json\0All files\0*.*\0\0".encode_utf16().collect();
    let title = wide(title);
    let ext = wide("json");
    let mut file = vec![0u16; 4096];
    for (i, c) in default_name.encode_utf16().enumerate().take(file.len() - 1) {
        file[i] = c;
    }
    let mut ofn = OPENFILENAMEW {
        lStructSize: std::mem::size_of::<OPENFILENAMEW>() as u32,
        hwndOwner: HWND::default(),
        lpstrFilter: windows::core::PCWSTR(filter.as_ptr()),
        lpstrFile: PWSTR(file.as_mut_ptr()),
        nMaxFile: file.len() as u32,
        lpstrTitle: windows::core::PCWSTR(title.as_ptr()),
        lpstrDefExt: windows::core::PCWSTR(ext.as_ptr()),
        Flags: if save {
            OFN_OVERWRITEPROMPT | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR
        } else {
            OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR
        },
        ..Default::default()
    };
    let ok = unsafe { if save { GetSaveFileNameW(&mut ofn) } else { GetOpenFileNameW(&mut ofn) } };
    if !ok.as_bool() {
        return None;
    }
    let len = file.iter().position(|&c| c == 0).unwrap_or(0);
    Some(String::from_utf16_lossy(&file[..len]))
}

/// Ask where to save and write `json` there. `Ok(None)` means cancelled.
pub fn save_backup(json: &str) -> Result<Option<String>, String> {
    let stamp = chrono_like_stamp();
    let Some(path) = dialog_path(true, "Save PocketPet backup", &format!("pocketpet-backup-{stamp}.json")) else {
        return Ok(None);
    };
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(Some(path))
}

/// Ask for a backup file and return its text. `Ok(None)` means cancelled.
pub fn load_backup() -> Result<Option<String>, String> {
    let Some(path) = dialog_path(false, "Open PocketPet backup", "") else {
        return Ok(None);
    };
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > MAX_BACKUP_BYTES {
        return Err("That file is too large to be a PocketPet backup.".into());
    }
    std::fs::read_to_string(&path).map(Some).map_err(|e| e.to_string())
}

/// YYYYMMDD-HHMM from the system clock, without pulling in a date crate.
fn chrono_like_stamp() -> String {
    use windows::Win32::System::SystemInformation::GetLocalTime;
    let t = unsafe { GetLocalTime() };
    format!("{:04}{:02}{:02}-{:02}{:02}", t.wYear, t.wMonth, t.wDay, t.wHour, t.wMinute)
}

// --- clipboard ----------------------------------------------------------------

/// Plain text currently on the clipboard, if any.
pub fn clipboard_text() -> Option<String> {
    use windows::Win32::System::DataExchange::{CloseClipboard, GetClipboardData, OpenClipboard};
    use windows::Win32::Foundation::HGLOBAL;
    use windows::Win32::System::Memory::{GlobalLock, GlobalUnlock};
    const CF_UNICODETEXT: u32 = 13;
    unsafe {
        if OpenClipboard(None).is_err() {
            return None;
        }
        let out = GetClipboardData(CF_UNICODETEXT).ok().and_then(|h| {
            let hg = HGLOBAL(h.0 as *mut _);
            let p = GlobalLock(hg) as *const u16;
            if p.is_null() {
                return None;
            }
            let mut len = 0;
            while *p.add(len) != 0 && len < 100_000 {
                len += 1;
            }
            let text = String::from_utf16_lossy(std::slice::from_raw_parts(p, len));
            let _ = GlobalUnlock(hg);
            Some(text)
        });
        let _ = CloseClipboard();
        out.filter(|t| !t.trim().is_empty())
    }
}

// --- updates ------------------------------------------------------------------
// GitHub Releases is the update feed: the newest release's `*-setup.exe` asset.
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
        .find(|a| a.get("browser_download_url").and_then(|u| u.as_str()).is_some_and(|u| u.ends_with("-setup.exe")));
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

/// Stream the installer to %TEMP%, reporting actual bytes received. Only a
/// completed download becomes an executable; the caller opens it and exits.
pub async fn download_update(url: &str, expected_sha256: &str, app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use std::io::Write;
    use tauri::Emitter;
    // Only our own release assets; GitHub redirects these to its CDN itself.
    if !url.starts_with(RELEASE_DOWNLOADS) || url.contains("..") || url.to_ascii_lowercase().contains("%2e") || !url.ends_with("-setup.exe") {
        return Err("Refusing to download an installer from outside GitHub.".into());
    }
    if expected_sha256.len() != 64 || !expected_sha256.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("Release installer has no valid SHA-256 digest.".into());
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
    let path = std::env::temp_dir().join(format!("PocketPet-update-{stamp}-setup.exe"));
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
            return Err("Downloaded file is too small to be the installer.".to_string());
        }
        if total.is_some_and(|expected| downloaded != expected) {
            return Err("The installer download was incomplete. Please try again.".to_string());
        }
        if format!("{:x}", hasher.finalize()) != expected_sha256.to_ascii_lowercase() {
            return Err("Installer SHA-256 digest did not match GitHub release metadata.".into());
        }
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        std::fs::rename(&partial, &path).map_err(|e| e.to_string())?;
        let _ = app.emit("pet://update-progress", UpdateProgress { downloaded, total, done: true });
        Ok(path.clone())
    }.await;
    if result.is_err() {
        let _ = std::fs::remove_file(&partial);
    }
    result
}

#[cfg(test)]
mod update_tests {
    use super::{release_digest, version_tuple};
    #[test]
    fn versions_compare_numerically() {
        assert!(version_tuple("v0.2.0") > version_tuple("0.1.9"));
        assert!(version_tuple("1.0.0") > version_tuple("v0.10.5"));
        assert_eq!(version_tuple("v0.1.0"), version_tuple("0.1.0"));
    }

    #[test]
    fn release_digest_requires_sha256() {
        let digest = "a".repeat(64);
        assert_eq!(release_digest(&serde_json::json!({ "digest": format!("sha256:{digest}") })), Some(digest));
        assert_eq!(release_digest(&serde_json::json!({ "digest": "sha256:bad" })), None);
        assert_eq!(release_digest(&serde_json::json!({ "digest": "sha512:bad" })), None);
    }
}
