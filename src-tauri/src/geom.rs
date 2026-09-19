//! Plain geometry and window descriptions shared by every platform. The
//! Windows modules fill these from Win32; the other platforms mostly hand back
//! empty values because they cannot see other apps' windows.

use serde::Serialize;

/// Rectangle in physical (device) pixels: left/top/width/height.
#[derive(Debug, Clone, Copy, Serialize, Default, PartialEq)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

impl Rect {
    #[cfg(windows)]
    pub fn from_win(r: windows::Win32::Foundation::RECT) -> Self {
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

/// Where a window's caption buttons are, if we could find them.
#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
pub struct CaptionButtons {
    pub minimize: Option<Rect>,
    pub maximize: Option<Rect>,
    pub close: Option<Rect>,
    /// Which strategy produced these rects: `titlebarinfoex`, `uia`, `guess`,
    /// or `none` on platforms without window access.
    pub source: &'static str,
}
