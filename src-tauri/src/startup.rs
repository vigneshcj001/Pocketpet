//! "Run at startup" and the global show/hide hotkey.
//!
//! Startup is the per-user `HKCU\...\Run` value: no admin rights, no task
//! scheduler, and the uninstaller's job is just to delete one value. The hotkey
//! is a plain `RegisterHotKey` on its own thread, which avoids pulling in a
//! plugin for a single key combination.

use std::ffi::c_void;

use tauri::AppHandle;
use windows::core::HSTRING;
use windows::Win32::Foundation::{ERROR_FILE_NOT_FOUND, ERROR_SUCCESS, HWND};
use windows::Win32::System::Registry::{
    RegDeleteKeyValueW, RegGetValueW, RegSetKeyValueW, HKEY_CURRENT_USER, REG_SZ, RRF_RT_REG_SZ,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    RegisterHotKey, MOD_ALT, MOD_CONTROL, MOD_NOREPEAT,
};
use windows::Win32::UI::WindowsAndMessaging::{GetMessageW, MSG, WM_HOTKEY};

const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const RUN_VALUE: &str = "PocketPet";

/// Human-readable form of the hotkey, for menus and bubbles.
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

/// Registers Ctrl+Alt+P and pumps messages for it forever. `WM_HOTKEY` is
/// posted to the registering *thread*, so this needs its own message loop and
/// must not be done on a thread that will go away.
pub fn spawn_hotkey_thread(app: AppHandle, on_press: fn(&AppHandle)) {
    std::thread::spawn(move || unsafe {
        let mods = MOD_CONTROL | MOD_ALT | MOD_NOREPEAT;
        if RegisterHotKey(HWND::default(), 1, mods, u32::from(b'P')).is_err() {
            // Another app owns the combination; the tray toggle still works.
            return;
        }
        let mut msg = MSG::default();
        while GetMessageW(&mut msg, HWND::default(), 0, 0).as_bool() {
            if msg.message == WM_HOTKEY {
                on_press(&app);
            }
        }
    });
}
