//! "Run at startup" and the global hotkeys.
//!
//! Startup is the per-user `HKCU\...\Run` value: no admin rights, no task
//! scheduler, and the uninstaller's job is just to delete one value. Hotkeys
//! are plain `RegisterHotKey` calls on their own thread, which avoids pulling
//! in a plugin for a handful of key combinations. The set is user-editable, so
//! the thread accepts "re-register" requests via a thread message.

use std::ffi::c_void;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;

use tauri::AppHandle;
use windows::core::HSTRING;
use windows::Win32::Foundation::{ERROR_FILE_NOT_FOUND, ERROR_SUCCESS, HWND, LPARAM, WPARAM};
use windows::Win32::System::Registry::{
    RegDeleteKeyValueW, RegGetValueW, RegSetKeyValueW, HKEY_CURRENT_USER, REG_SZ, RRF_RT_REG_SZ,
};
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    RegisterHotKey, UnregisterHotKey, HOT_KEY_MODIFIERS, MOD_ALT, MOD_CONTROL, MOD_NOREPEAT,
    MOD_SHIFT, MOD_WIN,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetMessageW, PostThreadMessageW, MSG, WM_APP, WM_HOTKEY,
};

const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const RUN_VALUE: &str = "PocketPet";

/// Default combination for hide/show, for menus and first-run settings.
pub const HOTKEY_LABEL: &str = "Ctrl+Alt+P";

pub fn autostart_enabled() -> bool {
    let key = HSTRING::from(RUN_KEY);
    let name = HSTRING::from(RUN_VALUE);
    let result =
        unsafe { RegGetValueW(HKEY_CURRENT_USER, &key, &name, RRF_RT_REG_SZ, None, None, None) };
    result == ERROR_SUCCESS
}

pub fn set_autostart(enabled: bool) -> bool {
    let key = HSTRING::from(RUN_KEY);
    let name = HSTRING::from(RUN_VALUE);
    unsafe {
        if enabled {
            let Ok(exe) = std::env::current_exe() else {
                return false;
            };
            let cmd = HSTRING::from(format!("\"{}\"", exe.display()));
            // REG_SZ wants the byte length including the terminating NUL.
            let bytes = ((cmd.len() + 1) * 2) as u32;
            RegSetKeyValueW(
                HKEY_CURRENT_USER,
                &key,
                &name,
                REG_SZ.0,
                Some(cmd.as_ptr() as *const c_void),
                bytes,
            ) == ERROR_SUCCESS
        } else {
            let result = RegDeleteKeyValueW(HKEY_CURRENT_USER, &key, &name);
            result == ERROR_SUCCESS || result == ERROR_FILE_NOT_FOUND
        }
    }
}

// --- hotkeys -----------------------------------------------------------------

/// Actions a hotkey can trigger. The numeric value doubles as the hotkey id.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HotkeyAction {
    Toggle = 1,
    Feed = 2,
    Play = 3,
    Settings = 4,
}

impl HotkeyAction {
    fn from_id(id: i32) -> Option<Self> {
        match id {
            1 => Some(Self::Toggle),
            2 => Some(Self::Feed),
            3 => Some(Self::Play),
            4 => Some(Self::Settings),
            _ => None,
        }
    }
}

/// Parsed combination: modifiers plus a virtual-key code.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Combo {
    pub mods: u32,
    pub vk: u32,
}

/// Parse "Ctrl+Alt+P", "Ctrl+Shift+F5", "Win+Alt+1". Returns `None` when the
/// text names no key or no modifier — a bare letter must never become a
/// global hotkey, it would eat the user's typing.
pub fn parse_combo(text: &str) -> Option<Combo> {
    let mut mods = 0u32;
    let mut vk = None;
    for part in text.split('+').map(|p| p.trim()).filter(|p| !p.is_empty()) {
        match part.to_ascii_lowercase().as_str() {
            "ctrl" | "control" => mods |= MOD_CONTROL.0,
            "alt" => mods |= MOD_ALT.0,
            "shift" => mods |= MOD_SHIFT.0,
            "win" | "super" | "meta" => mods |= MOD_WIN.0,
            key => {
                let code = match key {
                    k if k.len() == 1 && k.as_bytes()[0].is_ascii_alphanumeric() => {
                        Some(k.to_ascii_uppercase().as_bytes()[0] as u32)
                    }
                    k if k.starts_with('f') && k[1..].parse::<u32>().map_or(false, |n| (1..=24).contains(&n)) => {
                        Some(0x6F + k[1..].parse::<u32>().unwrap())
                    }
                    "space" => Some(0x20),
                    "tab" => Some(0x09),
                    "enter" | "return" => Some(0x0D),
                    "esc" | "escape" => Some(0x1B),
                    "home" => Some(0x24),
                    "end" => Some(0x23),
                    "pageup" | "pgup" => Some(0x21),
                    "pagedown" | "pgdn" => Some(0x22),
                    "insert" | "ins" => Some(0x2D),
                    "delete" | "del" => Some(0x2E),
                    "up" => Some(0x26),
                    "down" => Some(0x28),
                    "left" => Some(0x25),
                    "right" => Some(0x27),
                    _ => None,
                };
                vk = code;
            }
        }
    }
    match (mods, vk) {
        (0, _) | (_, None) => None,
        (mods, Some(vk)) => Some(Combo { mods, vk }),
    }
}

/// Desired bindings, written by `set_hotkeys`, read by the hotkey thread.
static WANTED: Mutex<Vec<(HotkeyAction, Combo)>> = Mutex::new(Vec::new());
/// Win32 thread id of the hotkey thread, so we can poke it.
static THREAD_ID: AtomicU32 = AtomicU32::new(0);
const WM_REBIND: u32 = WM_APP + 1;

/// Replace the whole binding set. Returns the actions that could not be
/// registered (typically because another app owns that combination).
pub fn set_hotkeys(bindings: Vec<(HotkeyAction, Combo)>) {
    if let Ok(mut w) = WANTED.lock() {
        *w = bindings;
    }
    let tid = THREAD_ID.load(Ordering::Relaxed);
    if tid != 0 {
        unsafe {
            let _ = PostThreadMessageW(tid, WM_REBIND, WPARAM(0), LPARAM(0));
        }
    }
}

fn apply_bindings(registered: &mut Vec<i32>) -> Vec<HotkeyAction> {
    unsafe {
        for id in registered.drain(..) {
            let _ = UnregisterHotKey(HWND::default(), id);
        }
    }
    let wanted = WANTED.lock().map(|w| w.clone()).unwrap_or_default();
    let mut failed = Vec::new();
    for (action, combo) in wanted {
        let id = action as i32;
        let mods = HOT_KEY_MODIFIERS(combo.mods | MOD_NOREPEAT.0);
        let ok = unsafe { RegisterHotKey(HWND::default(), id, mods, combo.vk) }.is_ok();
        if ok {
            registered.push(id);
        } else {
            failed.push(action);
        }
    }
    failed
}

/// Pumps messages for the hotkeys forever. `WM_HOTKEY` is posted to the
/// registering *thread*, so this needs its own message loop and must not be
/// done on a thread that will go away.
pub fn spawn_hotkey_thread(
    app: AppHandle,
    initial: Vec<(HotkeyAction, Combo)>,
    on_press: fn(&AppHandle, HotkeyAction),
) {
    if let Ok(mut w) = WANTED.lock() {
        *w = initial;
    }
    std::thread::spawn(move || unsafe {
        THREAD_ID.store(GetCurrentThreadId(), Ordering::Relaxed);
        let mut registered = Vec::new();
        apply_bindings(&mut registered);
        let mut msg = MSG::default();
        while GetMessageW(&mut msg, HWND::default(), 0, 0).as_bool() {
            match msg.message {
                WM_HOTKEY => {
                    if let Some(action) = HotkeyAction::from_id(msg.wParam.0 as i32) {
                        on_press(&app, action);
                    }
                }
                WM_REBIND => {
                    apply_bindings(&mut registered);
                }
                _ => {}
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_common_combos() {
        assert_eq!(parse_combo("Ctrl+Alt+P"), Some(Combo { mods: 3, vk: b'P' as u32 }));
        assert_eq!(parse_combo("ctrl + shift + f5"), Some(Combo { mods: 6, vk: 0x74 }));
        assert_eq!(parse_combo("Win+1"), Some(Combo { mods: 8, vk: b'1' as u32 }));
        assert_eq!(parse_combo("P"), None, "no modifier: would eat typing");
        assert_eq!(parse_combo("Ctrl+"), None);
        assert_eq!(parse_combo(""), None);
    }
}
