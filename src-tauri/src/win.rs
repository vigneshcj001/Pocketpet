//! Thin wrappers over the Win32 APIs PocketPet needs: cursor position, the
//! virtual screen rect, top-level window geometry, and driving a window's
//! system commands.

use serde::Serialize;
use std::ffi::c_void;

use windows::Win32::Foundation::{BOOL, HWND, LPARAM, POINT, RECT, WPARAM};
use windows::Win32::Graphics::Dwm::{
    DwmGetWindowAttribute, DWMWA_CLOAKED, DWMWA_EXTENDED_FRAME_BOUNDS,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_MOUSE, MOUSEEVENTF_ABSOLUTE, MOUSEEVENTF_LEFTDOWN,
    MOUSEEVENTF_LEFTUP, MOUSEEVENTF_MOVE, MOUSEEVENTF_VIRTUALDESK, MOUSEINPUT,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetCursorPos, GetForegroundWindow, GetSystemMetrics, GetWindowLongW,
    GetWindowTextLengthW, GetWindowTextW, IsIconic, IsWindowVisible, IsZoomed, PostMessageW,
    SetCursorPos, GWL_EXSTYLE, GWL_STYLE, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN,
    SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN, WM_SYSCOMMAND, WS_CHILD, WS_EX_TOOLWINDOW,
};

/// Rectangle in physical (device) pixels: left/top/width/height.
#[derive(Debug, Clone, Copy, Serialize, Default, PartialEq)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

impl Rect {
    pub fn from_win(r: RECT) -> Self {
        Rect { x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top }
    }
    pub fn is_empty(&self) -> bool {
        self.w <= 0 || self.h <= 0
    }
    pub fn center(&self) -> (i32, i32) {
        (self.x + self.w / 2, self.y + self.h / 2)
    }
    pub fn contains(&self, x: i32, y: i32) -> bool {
        x >= self.x && x < self.x + self.w && y >= self.y && y < self.y + self.h
    }
}

/// A top-level window the pet can perch on or interact with.
#[derive(Debug, Clone, Serialize)]
pub struct WindowInfo {
    /// HWND as an integer so it survives a round trip through JSON.
    pub hwnd: isize,
    pub title: String,
    pub rect: Rect,
    pub maximized: bool,
    pub minimized: bool,
    pub foreground: bool,
}

pub fn cursor_pos() -> (i32, i32) {
    let mut pt = POINT::default();
    unsafe {
        let _ = GetCursorPos(&mut pt);
    }
    (pt.x, pt.y)
}

/// Bounding box of every monitor combined. The overlay is sized to this so the
/// pet can roam across all displays.
pub fn virtual_screen() -> Rect {
    unsafe {
        Rect {
            x: GetSystemMetrics(SM_XVIRTUALSCREEN),
            y: GetSystemMetrics(SM_YVIRTUALSCREEN),
            w: GetSystemMetrics(SM_CXVIRTUALSCREEN),
            h: GetSystemMetrics(SM_CYVIRTUALSCREEN),
        }
    }
}

/// `GetWindowRect` includes the invisible resize border Windows 10+ draws
/// around windows, which leaves a pet standing on a titlebar floating ~8px
/// away from it. DWM's extended frame bounds is the rect the user actually
/// sees.
pub fn frame_bounds(hwnd: HWND) -> Option<Rect> {
    let mut r = RECT::default();
    let ok = unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_EXTENDED_FRAME_BOUNDS,
            &mut r as *mut RECT as *mut c_void,
            std::mem::size_of::<RECT>() as u32,
        )
    };
    if ok.is_ok() {
        let rect = Rect::from_win(r);
        if !rect.is_empty() {
            return Some(rect);
        }
    }
    None
}

/// UWP/WinUI apps keep hidden windows alive; DWM flags them as "cloaked".
/// Without this filter the pet tries to sit on invisible ghosts.
fn is_cloaked(hwnd: HWND) -> bool {
    let mut cloaked: u32 = 0;
    let ok = unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_CLOAKED,
            &mut cloaked as *mut u32 as *mut c_void,
            std::mem::size_of::<u32>() as u32,
        )
    };
    ok.is_ok() && cloaked != 0
}

fn window_title(hwnd: HWND) -> String {
    let len = unsafe { GetWindowTextLengthW(hwnd) };
    if len <= 0 {
        return String::new();
    }
    let mut buf = vec![0u16; len as usize + 1];
    let copied = unsafe { GetWindowTextW(hwnd, &mut buf) };
    if copied <= 0 {
        return String::new();
    }
    String::from_utf16_lossy(&buf[..copied as usize])
}

unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let out = &mut *(lparam.0 as *mut Vec<WindowInfo>);

    if !IsWindowVisible(hwnd).as_bool() {
        return BOOL::from(true);
    }
    let style = GetWindowLongW(hwnd, GWL_STYLE) as u32;
    if style & WS_CHILD.0 != 0 {
        return BOOL::from(true);
    }
    // Tool windows are palettes and tooltips, not things a pet should perch on.
    let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
    if ex_style & WS_EX_TOOLWINDOW.0 != 0 {
        return BOOL::from(true);
    }
    if is_cloaked(hwnd) {
        return BOOL::from(true);
    }
    let title = window_title(hwnd);
    if title.is_empty() || title == "PocketPet" {
        return BOOL::from(true);
    }
    let Some(rect) = frame_bounds(hwnd) else {
        return BOOL::from(true);
    };
    if rect.w < 80 || rect.h < 40 {
        return BOOL::from(true);
    }

    let fg = GetForegroundWindow();
    out.push(WindowInfo {
        hwnd: hwnd.0 as isize,
        title,
        rect,
        maximized: IsZoomed(hwnd).as_bool(),
        minimized: IsIconic(hwnd).as_bool(),
        foreground: fg == hwnd,
    });
    BOOL::from(true)
}

pub fn list_windows() -> Vec<WindowInfo> {
    let mut out: Vec<WindowInfo> = Vec::new();
    unsafe {
        let _ = EnumWindows(Some(enum_proc), LPARAM(&mut out as *mut _ as isize));
    }
    out
}

pub fn foreground_window() -> Option<WindowInfo> {
    let fg = raw_foreground();
    if fg == 0 {
        return None;
    }
    window_by_hwnd(fg)
}

/// The foreground HWND as a plain integer, 0 if there is none.
pub fn raw_foreground() -> isize {
    unsafe { GetForegroundWindow() }.0 as isize
}

/// Look a window up by HWND, with the same filtering as `list_windows` so a
/// stale or hidden handle comes back as `None` rather than a ghost.
pub fn window_by_hwnd(hwnd: isize) -> Option<WindowInfo> {
    if hwnd == 0 {
        return None;
    }
    list_windows().into_iter().find(|w| w.hwnd == hwnd)
}

// --- acting on a window ------------------------------------------------------

pub const SC_MINIMIZE: usize = 0xF020;
pub const SC_MAXIMIZE: usize = 0xF030;
pub const SC_CLOSE: usize = 0xF060;
pub const SC_RESTORE: usize = 0xF120;

/// Ask a window to close/minimise/restore without touching the real mouse.
/// This is the default path: it cannot mis-click, and it leaves the cursor
/// exactly where the user left it.
pub fn post_syscommand(hwnd_raw: isize, command: usize) -> bool {
    let hwnd = HWND(hwnd_raw as *mut c_void);
    unsafe { PostMessageW(hwnd, WM_SYSCOMMAND, WPARAM(command), LPARAM(0)).is_ok() }
}

/// Move the real cursor and left-click at a screen point, optionally putting
/// the cursor back afterwards. Only used when the user opts into "real click"
/// mode, because it genuinely hijacks their mouse for a few milliseconds.
pub fn real_click_at(x: i32, y: i32, restore: bool) -> bool {
    let (ox, oy) = cursor_pos();
    let vs = virtual_screen();
    if vs.w <= 1 || vs.h <= 1 {
        return false;
    }
    unsafe {
        let _ = SetCursorPos(x, y);
        // Absolute SendInput coordinates are 0..65535 across the virtual screen.
        let nx = ((x - vs.x) as i64 * 65535 / (vs.w - 1) as i64) as i32;
        let ny = ((y - vs.y) as i64 * 65535 / (vs.h - 1) as i64) as i32;
        let mk = |flags| INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT {
                    dx: nx,
                    dy: ny,
                    mouseData: 0,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };
        let inputs = [
            mk(MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK),
            mk(MOUSEEVENTF_LEFTDOWN | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK),
            mk(MOUSEEVENTF_LEFTUP | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK),
        ];
        let sent = SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
        if restore {
            let _ = SetCursorPos(ox, oy);
        }
        sent == inputs.len() as u32
    }
}
