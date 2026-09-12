//! Odds and ends the frontend asks for: monitor layout and a native image picker.

use base64::Engine;
use windows::core::PWSTR;
use windows::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
use windows::Win32::Graphics::Gdi::{
    EnumDisplayMonitors, GetMonitorInfoW, HDC, HMONITOR, MONITORINFO,
};
use windows::Win32::UI::Controls::Dialogs::{
    GetOpenFileNameW, OFN_FILEMUSTEXIST, OFN_NOCHANGEDIR, OFN_PATHMUSTEXIST, OPENFILENAMEW,
};

use crate::win::Rect;

/// Every monitor's bounds in physical pixels, so the pet can stand on the
/// bottom of *its* screen instead of the bottom of the tallest one.
pub fn monitors() -> Vec<Rect> {
    unsafe extern "system" fn cb(mon: HMONITOR, _: HDC, _: *mut RECT, data: LPARAM) -> BOOL {
        let out = &mut *(data.0 as *mut Vec<Rect>);
        let mut info = MONITORINFO { cbSize: std::mem::size_of::<MONITORINFO>() as u32, ..Default::default() };
        if GetMonitorInfoW(mon, &mut info).as_bool() {
            out.push(Rect::from_win(info.rcMonitor));
        }
        BOOL::from(true)
    }
    let mut out: Vec<Rect> = Vec::new();
    unsafe {
        let _ = EnumDisplayMonitors(HDC::default(), None, Some(cb), LPARAM(&mut out as *mut _ as isize));
    }
    out
}

/// Biggest image we will turn into a pet. It ends up in localStorage as a data
/// URL, and that has a budget of a few MB.
const MAX_IMAGE_BYTES: u64 = 1_500_000;

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

