//! Where PocketPet keeps its files (memory, logs, task audit trail, the pet's
//! browser profile), per platform.

use std::path::PathBuf;

/// `%LOCALAPPDATA%\PocketPet` on Windows, `~/Library/Application Support/PocketPet`
/// on macOS, `$XDG_DATA_HOME/PocketPet` (default `~/.local/share/PocketPet`) elsewhere.
pub fn data_dir() -> PathBuf {
    #[cfg(windows)]
    {
        let local = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".into());
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
