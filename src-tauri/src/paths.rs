//! Where PocketPet keeps its files (memory, logs, task audit trail, the pet's
//! browser profile), per platform, plus the process-environment fixes that
//! make the Linux build behave on Wayland desktops and inside an AppImage.

use std::path::PathBuf;
#[cfg(target_os = "linux")]
use std::sync::atomic::{AtomicBool, Ordering};

/// `%LOCALAPPDATA%\PocketPet` on Windows, `~/Library/Application Support/PocketPet`
/// on macOS, `$XDG_DATA_HOME/PocketPet` (default `~/.local/share/PocketPet`) elsewhere.
pub fn data_dir() -> PathBuf {
    #[cfg(windows)]
    {
        let local = std::env::var("LOCALAPPDATA")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| std::env::var("USERPROFILE").ok().map(|home| format!(r"{home}\AppData\Local")))
            .unwrap_or_else(|| ".".into());
        PathBuf::from(local).join("PocketPet")
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
        PathBuf::from(home).join("Library").join("Application Support").join("PocketPet")
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let base = std::env::var("XDG_DATA_HOME")
            .ok()
            .filter(|s| !s.is_empty())
            .map(PathBuf::from)
            .filter(|p| p.is_absolute())
            .unwrap_or_else(|| {
                let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
                PathBuf::from(home).join(".local").join("share")
            });
        base.join("PocketPet")
    }
}

/// Variables `prepare_linux_environment` set for our own process only. They
/// are removed again for programs we launch (browser, xdg-open).
#[cfg(target_os = "linux")]
static SET_GDK_BACKEND: AtomicBool = AtomicBool::new(false);
#[cfg(target_os = "linux")]
static SET_DMABUF: AtomicBool = AtomicBool::new(false);

/// Linux only, and only before GTK starts (call it first thing in `main`):
///
/// * On a Wayland session that also runs XWayland, prefer the X11 backend.
///   Wayland gives no global cursor position and no click-through overlay, so
///   under native Wayland the pet could neither follow the cursor nor let
///   clicks pass. Set `POCKETPET_NATIVE_WAYLAND=1` (or your own `GDK_BACKEND`)
///   to opt out.
/// * Disable WebKitGTK's DMA-BUF renderer unless the user chose otherwise. On
///   NVIDIA and several Wayland compositors it draws a transparent window as a
///   blank or black rectangle.
///
/// A no-op on Windows and macOS.
pub fn prepare_linux_environment() {
    #[cfg(target_os = "linux")]
    {
        let set = |key: &str| std::env::var_os(key).is_some_and(|v| !v.is_empty());
        let wayland = set("WAYLAND_DISPLAY")
            || std::env::var("XDG_SESSION_TYPE").is_ok_and(|s| s.eq_ignore_ascii_case("wayland"));
        if wayland && set("DISPLAY") && !set("GDK_BACKEND") && !set("POCKETPET_NATIVE_WAYLAND") {
            std::env::set_var("GDK_BACKEND", "x11");
            SET_GDK_BACKEND.store(true, Ordering::Relaxed);
        }
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
            SET_DMABUF.store(true, Ordering::Relaxed);
        }
    }
}

/// A `Command` for a program that belongs to the host system rather than to
/// PocketPet (the user's browser, `xdg-open`, `open`).
///
/// Inside an AppImage, `AppRun` points `LD_LIBRARY_PATH`, `GST_PLUGIN_*`,
/// `GIO_MODULE_DIR`, `XDG_DATA_DIRS` and friends at the bundle. A system
/// Chrome or file manager started with those inherits our libraries and can
/// crash or misbehave, so every entry under `$APPDIR` is stripped here.
pub fn host_command(program: impl AsRef<std::ffi::OsStr>) -> std::process::Command {
    #[allow(unused_mut)]
    let mut command = std::process::Command::new(program);
    #[cfg(target_os = "linux")]
    {
        if SET_GDK_BACKEND.load(Ordering::Relaxed) {
            command.env_remove("GDK_BACKEND");
        }
        if SET_DMABUF.load(Ordering::Relaxed) {
            command.env_remove("WEBKIT_DISABLE_DMABUF_RENDERER");
        }
        if let Some(appdir) = std::env::var("APPDIR").ok().filter(|d| d.len() > 1) {
            for (key, value) in std::env::vars() {
                if !value.contains(&appdir) {
                    continue;
                }
                let kept: Vec<&str> = value.split(':').filter(|part| !part.is_empty() && !part.starts_with(&appdir)).collect();
                if kept.is_empty() {
                    command.env_remove(&key);
                } else {
                    command.env(&key, kept.join(":"));
                }
            }
            for key in ["APPDIR", "APPIMAGE", "ARGV0", "OWD"] {
                command.env_remove(key);
            }
        }
    }
    command
}

/// Open a file, folder or URL with the desktop's default handler without
/// leaving a zombie process behind.
#[cfg(not(windows))]
pub fn open_with_desktop(target: &str) -> bool {
    let program = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
    match host_command(program).arg(target).spawn() {
        Ok(mut child) => {
            std::thread::spawn(move || {
                let _ = child.wait();
            });
            true
        }
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn data_dir_is_named_after_the_app() {
        assert_eq!(data_dir().file_name().and_then(|n| n.to_str()), Some("PocketPet"));
    }

    #[test]
    fn host_command_keeps_the_program() {
        let command = host_command("definitely-not-a-real-program");
        assert_eq!(command.get_program(), "definitely-not-a-real-program");
    }
}
