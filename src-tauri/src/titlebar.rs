//! Locating a window's minimise / maximise / close buttons.
//!
//! There is no single API that works everywhere, so we try three strategies in
//! order of fidelity:
//!
//! 1. `WM_GETTITLEBARINFOEX` - exact rects, but only for windows that let the
//!    system draw their caption (classic Win32 apps, most dialogs).
//! 2. UI Automation - covers custom titlebars: WinUI/Windows 11 Explorer and
//!    Settings, Chrome, Edge, Electron apps like VS Code.
//! 3. A geometric guess from the window rect - never fails, never exact. Only
//!    used to aim the pet's paw; the actual action still goes through
//!    `WM_SYSCOMMAND`, so a wrong guess is cosmetic, not destructive.

use std::cell::RefCell;
use std::collections::HashMap;
use std::ffi::c_void;
use std::time::{Duration, Instant};

use serde::Serialize;
use windows::core::{Interface, VARIANT};
use windows::Win32::Foundation::{HWND, LPARAM, RECT, WPARAM};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED,
};
use windows::Win32::UI::Accessibility::{
    CUIAutomation, IUIAutomation, IUIAutomationElement, TreeScope_Descendants,
    UIA_ButtonControlTypeId, UIA_ControlTypePropertyId,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetSystemMetrics, SendMessageTimeoutW, SMTO_ABORTIFHUNG, SM_CXSIZE, SM_CYCAPTION,
};

use crate::win::Rect;

const WM_GETTITLEBARINFOEX: u32 = 0x033F;
const STATE_SYSTEM_UNAVAILABLE: u32 = 0x0000_0001;
const STATE_SYSTEM_INVISIBLE: u32 = 0x0000_8000;
const STATE_SYSTEM_OFFSCREEN: u32 = 0x0001_0000;

/// Indices into `TITLEBARINFOEX::rgrect`.
const IDX_MINIMIZE: usize = 2;
const IDX_MAXIMIZE: usize = 3;
const IDX_CLOSE: usize = 5;

#[repr(C)]
#[derive(Clone, Copy)]
struct TitlebarInfoEx {
    cb_size: u32,
    rc_titlebar: RECT,
    rgstate: [u32; 6],
    rgrect: [RECT; 6],
}

impl Default for TitlebarInfoEx {
    fn default() -> Self {
        TitlebarInfoEx {
            cb_size: std::mem::size_of::<TitlebarInfoEx>() as u32,
            rc_titlebar: RECT::default(),
            rgstate: [0; 6],
            rgrect: [RECT::default(); 6],
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
pub struct CaptionButtons {
    pub minimize: Option<Rect>,
    pub maximize: Option<Rect>,
    pub close: Option<Rect>,
    /// Which strategy produced these rects: `titlebarinfoex`, `uia`, or `guess`.
    pub source: &'static str,
}

impl CaptionButtons {
    fn is_useful(&self) -> bool {
        self.close.is_some() || self.minimize.is_some()
    }
}

fn usable(state: u32, r: RECT) -> Option<Rect> {
    if state & (STATE_SYSTEM_INVISIBLE | STATE_SYSTEM_OFFSCREEN | STATE_SYSTEM_UNAVAILABLE) != 0 {
        return None;
    }
    let rect = Rect::from_win(r);
    if rect.is_empty() {
        None
    } else {
        Some(rect)
    }
}

// --- strategy 1: WM_GETTITLEBARINFOEX ---------------------------------------

fn from_titlebarinfoex(hwnd: HWND) -> Option<CaptionButtons> {
    let mut info = TitlebarInfoEx::default();
    // SendMessageTimeout rather than SendMessage: a hung target window would
    // otherwise block the pet's whole thread.
    let result = unsafe {
        SendMessageTimeoutW(
            hwnd,
            WM_GETTITLEBARINFOEX,
            WPARAM(0),
            LPARAM(&mut info as *mut TitlebarInfoEx as isize),
            SMTO_ABORTIFHUNG,
            200,
            None,
        )
    };
    if result.0 == 0 {
        return None;
    }
    let buttons = CaptionButtons {
        minimize: usable(info.rgstate[IDX_MINIMIZE], info.rgrect[IDX_MINIMIZE]),
        maximize: usable(info.rgstate[IDX_MAXIMIZE], info.rgrect[IDX_MAXIMIZE]),
        close: usable(info.rgstate[IDX_CLOSE], info.rgrect[IDX_CLOSE]),
        source: "titlebarinfoex",
    };
    buttons.is_useful().then_some(buttons)
}

// --- strategy 2: UI Automation ----------------------------------------------

thread_local! {
    /// Creating the automation object costs a few milliseconds, so keep one per
    /// thread. `None` means we tried and failed; don't retry every frame.
    static AUTOMATION: RefCell<Option<Option<IUIAutomation>>> = const { RefCell::new(None) };
}

fn automation() -> Option<IUIAutomation> {
    AUTOMATION.with(|cell| {
        let mut slot = cell.borrow_mut();
        if slot.is_none() {
            let created = unsafe {
                // RPC_E_CHANGED_MODE just means the thread is already in a
                // different apartment, which is fine for UIA.
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
                CoCreateInstance::<_, IUIAutomation>(&CUIAutomation, None, CLSCTX_INPROC_SERVER)
                    .ok()
            };
            *slot = Some(created);
        }
        slot.as_ref().and_then(|o| o.clone())
    })
}

fn element_name(el: &IUIAutomationElement) -> String {
    unsafe { el.CurrentName() }
        .map(|s| s.to_string())
        .unwrap_or_default()
}

fn element_automation_id(el: &IUIAutomationElement) -> String {
    unsafe { el.CurrentAutomationId() }
        .map(|s| s.to_string())
        .unwrap_or_default()
}

/// Match a caption button by its automation id first (not localised, and what
/// WinUI/Chromium use), then by name (localised, so only a hint).
fn classify(name: &str, automation_id: &str) -> Option<&'static str> {
    let id = automation_id.to_ascii_lowercase();
    let n = name.to_ascii_lowercase();
    for hay in [id.as_str(), n.as_str()] {
        if hay.contains("close") {
            return Some("close");
        }
        if hay.contains("minimi") {
            return Some("minimize");
        }
        if hay.contains("maximi") || hay.contains("restore") {
            return Some("maximize");
        }
    }
    None
}

fn from_uia(hwnd: HWND, window: Rect) -> Option<CaptionButtons> {
    let uia = automation()?;
    let root = unsafe { uia.ElementFromHandle(hwnd) }.ok()?;

    let control_type = VARIANT::from(UIA_ButtonControlTypeId.0);
    let cond = unsafe { uia.CreatePropertyCondition(UIA_ControlTypePropertyId, &control_type) }
        .ok()?;
    let found = unsafe { root.FindAll(TreeScope_Descendants, &cond) }.ok()?;
    let count = unsafe { found.Length() }.ok()?;
    if count == 0 {
        return None;
    }

    // Caption buttons live in the top strip of the window, flush to the right
    // edge. Anything else is page content and would send the pet wandering.
    let caption_band = (window.h.min(56)).max(24);
    let mut candidates: Vec<(Rect, Option<&'static str>)> = Vec::new();
    for i in 0..count.min(400) {
        let Ok(el) = (unsafe { found.GetElement(i) }) else { continue };
        let Ok(r) = (unsafe { el.CurrentBoundingRectangle() }) else { continue };
        let rect = Rect::from_win(r);
        if rect.is_empty() || rect.w > 120 || rect.h > 80 {
            continue;
        }
        if rect.y > window.y + caption_band {
            continue;
        }
        if rect.x + rect.w < window.x + window.w - 200 {
            continue;
        }
        let kind = classify(&element_name(&el), &element_automation_id(&el));
        candidates.push((rect, kind));
    }
    if candidates.is_empty() {
        return None;
    }

    let mut out =
        CaptionButtons { minimize: None, maximize: None, close: None, source: "uia" };
    for (rect, kind) in &candidates {
        match kind {
            Some("close") => out.close = Some(*rect),
            Some("minimize") => out.minimize = Some(*rect),
            Some("maximize") => out.maximize = Some(*rect),
            _ => {}
        }
    }

    // Nothing matched by name - fall back to position, which is locale-proof:
    // the rightmost caption button is close, then maximize, then minimize.
    if !out.is_useful() {
        candidates.sort_by_key(|(r, _)| r.x);
        let tail: Vec<Rect> = candidates.iter().rev().take(3).map(|(r, _)| *r).collect();
        out.close = tail.first().copied();
        out.maximize = tail.get(1).copied();
        out.minimize = tail.get(2).copied();
    }

    out.is_useful().then_some(out)
}

// --- strategy 3: geometric guess --------------------------------------------

fn guess(window: Rect) -> CaptionButtons {
    let caption = unsafe { GetSystemMetrics(SM_CYCAPTION) }.max(24);
    let bw = (unsafe { GetSystemMetrics(SM_CXSIZE) }.max(32) as f32 * 1.4) as i32;
    let top = window.y;
    let right = window.x + window.w;
    let mk = |slot: i32| Rect { x: right - bw * (slot + 1), y: top, w: bw, h: caption };
    CaptionButtons {
        close: Some(mk(0)),
        maximize: Some(mk(1)),
        minimize: Some(mk(2)),
        source: "guess",
    }
}

// --- public entry point ------------------------------------------------------

thread_local! {
    static CACHE: RefCell<HashMap<isize, (Instant, CaptionButtons)>> =
        RefCell::new(HashMap::new());
}

const CACHE_TTL: Duration = Duration::from_millis(1500);

/// Best-effort caption button rects for a window, in physical screen pixels.
/// Results are cached briefly because the UIA path can cost tens of
/// milliseconds on large apps.
pub fn caption_buttons(hwnd_raw: isize, window: Rect) -> CaptionButtons {
    if let Some(hit) = CACHE.with(|c| {
        c.borrow()
            .get(&hwnd_raw)
            .filter(|(at, _)| at.elapsed() < CACHE_TTL)
            .map(|(_, b)| *b)
    }) {
        return hit;
    }

    let hwnd = HWND(hwnd_raw as *mut c_void);
    let found = from_titlebarinfoex(hwnd)
        .or_else(|| from_uia(hwnd, window))
        .unwrap_or_else(|| guess(window));

    CACHE.with(|c| {
        let mut map = c.borrow_mut();
        if map.len() > 64 {
            map.clear();
        }
        map.insert(hwnd_raw, (Instant::now(), found));
    });
    found
}

/// Silence the unused-import warning for `Interface`, which the UIA casts need
/// in some windows-rs versions.
#[allow(dead_code)]
fn _assert_interface<T: Interface>() {}
