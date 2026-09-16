//! PocketPet - a desktop pet that lives in a click-through overlay spanning every
//! monitor, walks to your cursor, perches on your windows, and can reach out
//! and press their caption buttons.

mod extras;
mod startup;
mod titlebar;
mod win;

use std::ffi::c_void;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};
use tauri_plugin_notification::NotificationExt;

use titlebar::CaptionButtons;
use win::{Rect, WindowInfo};

/// Areas of the overlay that should swallow clicks instead of passing them
/// through: the pet's body and any open speech bubble. Physical pixels.
#[derive(Default)]
struct HitRegions(Mutex<Vec<Rect>>);

/// HWND of the last foreground window that wasn't our overlay.
///
/// `WS_EX_NOACTIVATE` only stops *mouse* activation; the moment the user clicks
/// the pet, WebView2 focuses its child window and the overlay becomes the
/// foreground window anyway. So by the time a menu action asks "what is the
/// user looking at?", `GetForegroundWindow` answers "you". The cursor thread
/// keeps the previous answer around for exactly that case.
#[derive(Default)]
struct LastForeground(Mutex<isize>);

/// Runtime toggles that the cursor thread needs to read cheaply.
struct Flags {
    /// When false the overlay is click-through everywhere, so the pet becomes
    /// pure decoration and can never intercept a click.
    interactive: AtomicBool,
    /// Overlay hidden via the tray or the hotkey.
    hidden: AtomicBool,
    /// While the user is choosing where to put food, every click belongs to
    /// us, not to whatever is underneath.
    capture_all: AtomicBool,
}

#[derive(Debug, Clone, Serialize)]
struct ScreenInfo {
    /// Bounding box of all monitors, in physical pixels. The frontend reads
    /// this as `screen.virtual`.
    #[serde(rename = "virtual")]
    virtual_screen: Rect,
    /// Overlay scale factor, for converting physical pixels to CSS pixels.
    scale: f64,
    /// Each monitor's bounds, physical pixels.
    monitors: Vec<Rect>,
    /// Same order as `monitors`: the part not covered by the taskbar.
    work_areas: Vec<Rect>,
}

/// What the frontend needs to decide on focus mode and low-power behaviour.
#[derive(Debug, Clone, Serialize)]
struct Environment {
    /// The foreground window is a borderless fullscreen app (game, slideshow).
    fullscreen: bool,
    on_battery: bool,
}

#[derive(Debug, Clone, Deserialize)]
struct Shortcuts {
    toggle: String,
    feed: String,
    play: String,
    settings: String,
}

#[derive(Debug, Clone, Serialize)]
struct CursorEvent {
    x: i32,
    y: i32,
}

#[derive(Debug, Clone, Deserialize)]
struct RegionInput {
    x: i32,
    y: i32,
    w: i32,
    h: i32,
}

#[derive(Debug, Clone, Serialize)]
struct WindowTarget {
    window: WindowInfo,
    buttons: CaptionButtons,
}

// --- commands ----------------------------------------------------------------

#[tauri::command]
fn get_screen(window: WebviewWindow) -> ScreenInfo {
    let layout = extras::monitor_layout();
    ScreenInfo {
        virtual_screen: win::virtual_screen(),
        scale: window.scale_factor().unwrap_or(1.0),
        monitors: layout.iter().map(|(m, _)| *m).collect(),
        work_areas: layout.iter().map(|(_, w)| *w).collect(),
    }
}

/// The frontend reports where the pet currently is so the cursor thread can
/// decide, per frame, whether clicks belong to the pet or to whatever is
/// underneath. Tauri has no per-region hit testing, so this polling dance is
/// the supported workaround.
#[tauri::command]
fn set_hit_regions(regions: Vec<RegionInput>, state: State<'_, HitRegions>) {
    let mapped = regions
        .into_iter()
        .map(|r| Rect { x: r.x, y: r.y, w: r.w, h: r.h })
        .collect();
    if let Ok(mut guard) = state.0.lock() {
        *guard = mapped;
    }
}

#[tauri::command]
fn set_interactive(enabled: bool, flags: State<'_, Flags>) {
    flags.interactive.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
fn set_capture_all(enabled: bool, flags: State<'_, Flags>) {
    flags.capture_all.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
fn list_windows() -> Vec<WindowInfo> {
    win::list_windows()
}

#[tauri::command]
fn get_foreground_window(last: State<'_, LastForeground>) -> Option<WindowTarget> {
    let window = win::foreground_window().or_else(|| {
        let hwnd = *last.0.lock().ok()?;
        win::window_by_hwnd(hwnd)
    })?;
    let buttons = titlebar::caption_buttons(window.hwnd, window.rect);
    Some(WindowTarget { window, buttons })
}

#[tauri::command]
fn get_caption_buttons(hwnd: isize) -> Option<CaptionButtons> {
    let rect = win::frame_bounds(win_handle(hwnd))?;
    Some(titlebar::caption_buttons(hwnd, rect))
}

fn win_handle(raw: isize) -> windows::Win32::Foundation::HWND {
    windows::Win32::Foundation::HWND(raw as *mut c_void)
}

/// Press a caption button on someone else's window.
///
/// `real_click` decides how: the default posts `WM_SYSCOMMAND`, which cannot
/// mis-click and leaves the user's cursor untouched. The opt-in path warps the
/// real mouse to the button and clicks it, which looks more convincing but
/// briefly takes over the pointer.
#[tauri::command]
fn press_caption_button(hwnd: isize, which: String, real_click: bool) -> bool {
    let Some(rect) = win::frame_bounds(win_handle(hwnd)) else {
        return false;
    };
    let buttons = titlebar::caption_buttons(hwnd, rect);

    let (target, command) = match which.as_str() {
        "close" => (buttons.close, win::SC_CLOSE),
        "minimize" => (buttons.minimize, win::SC_MINIMIZE),
        "maximize" => (buttons.maximize, win::SC_MAXIMIZE),
        "restore" => (buttons.maximize, win::SC_RESTORE),
        _ => return false,
    };

    if real_click {
        // Only trust a real click when we know exactly where the button is.
        if buttons.source != "guess" {
            if let Some(r) = target {
                let (cx, cy) = r.center();
                if win::real_click_at(cx, cy, true) {
                    return true;
                }
            }
        }
    }
    win::post_syscommand(hwnd, command)
}

#[tauri::command]
fn get_autostart() -> bool {
    startup::autostart_enabled()
}

#[tauri::command]
fn set_autostart(enabled: bool, app: AppHandle) -> bool {
    let ok = startup::set_autostart(enabled);
    if let Some(t) = app.try_state::<TrayToggles>() {
        let _ = t.autostart.set_checked(startup::autostart_enabled());
    }
    ok
}

#[tauri::command]
fn set_hidden(hidden: bool, app: AppHandle) {
    apply_hidden(&app, hidden);
}

/// The frontend owns size/speed/break settings (they live in localStorage), so
/// it tells the tray which radio entries to tick after boot and on every change.
#[tauri::command]
fn sync_tray(size: String, speed: String, break_mins: u32, app: AppHandle) {
    if let Some(t) = app.try_state::<TrayToggles>() {
        t.select_radio(&format!("size:{size}"));
        t.select_radio(&format!("speed:{speed}"));
        t.select_radio(&format!("break:{break_mins}"));
    }
}

/// Native file picker; resolves to a data: URL, null on cancel, Err with a
/// user-facing message otherwise.
#[tauri::command]
async fn pick_image() -> Result<Option<String>, String> {
    // Modal dialogs block; keep them off the main thread.
    tauri::async_runtime::spawn_blocking(extras::pick_image)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn get_environment(window: WebviewWindow) -> Environment {
    let ours = window.hwnd().map(|h| h.0 as isize).unwrap_or(0);
    let fg = win::raw_foreground();
    let fullscreen = fg != 0 && win::root_window(fg) != win::root_window(ours) && win::is_fullscreen(fg);
    Environment { fullscreen, on_battery: win::on_battery() }
}

/// Re-register the global hotkeys from the user's settings. Returns the
/// names of actions whose combination could not be parsed or registered.
#[tauri::command]
fn set_hotkeys(shortcuts: Shortcuts) -> Vec<String> {
    use startup::{parse_combo, HotkeyAction};
    let mut bindings = Vec::new();
    let mut bad = Vec::new();
    for (name, text, action) in [
        ("toggle", &shortcuts.toggle, HotkeyAction::Toggle),
        ("feed", &shortcuts.feed, HotkeyAction::Feed),
        ("play", &shortcuts.play, HotkeyAction::Play),
        ("settings", &shortcuts.settings, HotkeyAction::Settings),
    ] {
        if text.trim().is_empty() {
            continue; // unbound on purpose
        }
        match parse_combo(text) {
            Some(combo) => bindings.push((action, combo)),
            None => bad.push(name.to_string()),
        }
    }
    startup::set_hotkeys(bindings);
    bad
}

#[tauri::command]
async fn save_backup(json: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || extras::save_backup(&json))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn load_backup() -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(extras::load_backup)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn notify(title: String, body: String, app: AppHandle) {
    let _ = app.notification().builder().title(title).body(body).show();
}

/// Async on purpose: on Windows, building a window from a synchronous command
/// deadlocks the main thread (the command holds it while the webview waits on it).
#[tauri::command]
async fn open_settings(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("settings") {
        let _ = existing.unminimize();
        let _ = existing.set_focus();
        return Ok(());
    }
    WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App("settings.html".into()))
        .title("PocketPet settings")
        .inner_size(400.0, 640.0)
        .resizable(false)
        .maximizable(false)
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

/// Hide or show the overlay and keep the tray tick and the frontend in step.
/// Called from the tray, the hotkey thread and the pet's own menu.
fn apply_hidden(app: &AppHandle, hidden: bool) {
    if let Some(flags) = app.try_state::<Flags>() {
        flags.hidden.store(hidden, Ordering::Relaxed);
    }
    if let Some(t) = app.try_state::<TrayToggles>() {
        let _ = t.hide.set_checked(hidden);
    }
    // Show first so the fade-in has something to draw on; on hide, let the
    // frontend fade out before the window actually disappears.
    if !hidden {
        if let Some(window) = app.get_webview_window("overlay") {
            let _ = window.show();
        }
    }
    let _ = app.emit("pet://menu", serde_json::json!({ "id": "toggle:hidden", "value": hidden }));
    if hidden {
        let app = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(260));
            // Still meant to be hidden? (The user may have toggled again.)
            let still = app
                .try_state::<Flags>()
                .map(|f| f.hidden.load(Ordering::Relaxed))
                .unwrap_or(true);
            if still {
                if let Some(window) = app.get_webview_window("overlay") {
                    let _ = window.hide();
                }
            }
        });
    }
}

fn toggle_hidden(app: &AppHandle) {
    let hidden = app
        .try_state::<Flags>()
        .map(|f| f.hidden.load(Ordering::Relaxed))
        .unwrap_or(false);
    apply_hidden(app, !hidden);
}

/// Global hotkey pressed. Everything except hide/show is a frontend concern,
/// so it goes out as the same event the tray menu uses.
fn on_hotkey(app: &AppHandle, action: startup::HotkeyAction) {
    use startup::HotkeyAction::*;
    match action {
        Toggle => toggle_hidden(app),
        Feed => {
            let _ = app.emit("pet://menu", serde_json::json!({ "id": "act:feed" }));
        }
        Play => {
            let _ = app.emit("pet://menu", serde_json::json!({ "id": "act:ball" }));
        }
        Settings => {
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                let _ = open_settings(app).await;
            });
        }
    }
}

// --- overlay plumbing --------------------------------------------------------

/// Stretch the overlay across every monitor and mark it as a non-activating
/// tool window, so it never steals focus, never appears in Alt-Tab, and never
/// shows up in the taskbar.
fn configure_overlay(window: &WebviewWindow) -> tauri::Result<()> {
    let vs = win::virtual_screen();
    window.set_position(PhysicalPosition::new(vs.x, vs.y))?;
    window.set_size(PhysicalSize::new(vs.w.max(1) as u32, vs.h.max(1) as u32))?;
    window.set_ignore_cursor_events(true)?;

    if let Ok(hwnd) = window.hwnd() {
        use windows::Win32::UI::WindowsAndMessaging::{
            GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_NOACTIVATE,
            WS_EX_TOOLWINDOW,
        };
        unsafe {
            let hwnd = windows::Win32::Foundation::HWND(hwnd.0 as *mut c_void);
            let current = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            let wanted = current | (WS_EX_NOACTIVATE.0 as isize) | (WS_EX_TOOLWINDOW.0 as isize);
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, wanted);
        }
    }

    window.show()?;
    Ok(())
}

/// Polls the global cursor at ~60Hz. It has two jobs: feed the frontend the
/// cursor position (the pet chases it), and flip the overlay between
/// click-through and interactive depending on whether the cursor is over the
/// pet. Doing this in Rust keeps it off the webview's main thread and out of
/// the IPC hot path.
fn spawn_cursor_thread(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last_pos = (i32::MIN, i32::MIN);
        let mut click_through = true;

        loop {
            std::thread::sleep(Duration::from_millis(16));

            let Some(window) = app.get_webview_window("overlay") else {
                continue;
            };
            let (x, y) = win::cursor_pos();

            let ours = window.hwnd().map(|h| h.0 as isize).unwrap_or(0);
            let fg = win::raw_foreground();
            if fg != 0 && fg != ours {
                if let Some(state) = app.try_state::<LastForeground>() {
                    if let Ok(mut guard) = state.0.lock() {
                        *guard = fg;
                    }
                }
            }

            if (x, y) != last_pos {
                last_pos = (x, y);
                let _ = app.emit("pet://cursor", CursorEvent { x, y });
            }

            let (interactive, capture_all) = app
                .try_state::<Flags>()
                .map(|f| {
                    (f.interactive.load(Ordering::Relaxed), f.capture_all.load(Ordering::Relaxed))
                })
                .unwrap_or((false, false));

            let over_pet = interactive
                && app
                    .try_state::<HitRegions>()
                    .and_then(|s| s.0.lock().ok().map(|r| r.iter().any(|reg| reg.contains(x, y))))
                    .unwrap_or(false);

            let want_click_through = !(over_pet || capture_all);
            if want_click_through != click_through {
                click_through = want_click_through;
                let _ = window.set_ignore_cursor_events(click_through);
            }
        }
    });
}

// --- tray --------------------------------------------------------------------

const PETS: [(&str, &str); 4] =
    [("cat", "Cat"), ("duck", "Duck"), ("panda", "Panda"), ("penguin", "Penguin")];

/// Radio-style groups as `(id, label)`. muda has no radio item, so one
/// CheckMenuItem per entry is ticked by hand in `select_radio`.
const SIZES: [(&str, &str); 3] =
    [("size:small", "Small"), ("size:medium", "Medium"), ("size:large", "Large")];
const SPEEDS: [(&str, &str); 3] =
    [("speed:slow", "Slow"), ("speed:normal", "Normal"), ("speed:fast", "Fast")];
const BREAKS: [(&str, &str); 4] = [
    ("break:0", "Off"),
    ("break:25", "Every 25 min"),
    ("break:45", "Every 45 min"),
    ("break:60", "Every 60 min"),
];

/// Kept so menu-event handling can read back the checkbox the user just
/// toggled; muda flips the tick itself, we only need its new value.
struct TrayToggles {
    follow: CheckMenuItem<tauri::Wry>,
    mischief: CheckMenuItem<tauri::Wry>,
    real_click: CheckMenuItem<tauri::Wry>,
    autostart: CheckMenuItem<tauri::Wry>,
    hide: CheckMenuItem<tauri::Wry>,
    /// Every item of every radio group, keyed by its full id (`size:small`).
    radios: Vec<(String, CheckMenuItem<tauri::Wry>)>,
}

impl TrayToggles {
    /// Tick `id` and untick its siblings (same `prefix:`).
    fn select_radio(&self, id: &str) {
        let Some(prefix) = id.split(':').next() else { return };
        for (other, item) in &self.radios {
            if other.split(':').next() == Some(prefix) {
                let _ = item.set_checked(other == id);
            }
        }
    }
}

fn radio_group(
    app: &AppHandle,
    title: &str,
    entries: &[(&str, &str)],
    out: &mut Vec<(String, CheckMenuItem<tauri::Wry>)>,
) -> tauri::Result<Submenu<tauri::Wry>> {
    let mut items = Vec::new();
    for (id, label) in entries {
        let item = CheckMenuItem::with_id(app, *id, *label, true, false, None::<&str>)?;
        out.push((id.to_string(), item.clone()));
        items.push(item);
    }
    let refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> =
        items.iter().map(|i| i as &dyn tauri::menu::IsMenuItem<tauri::Wry>).collect();
    Submenu::with_items(app, title, true, &refs)
}

fn build_tray(app: &AppHandle) -> tauri::Result<TrayToggles> {
    let mut pet_items: Vec<MenuItem<tauri::Wry>> = Vec::new();
    for (id, label) in PETS {
        pet_items.push(MenuItem::with_id(app, format!("pet:{id}"), label, true, None::<&str>)?);
    }
    let pet_refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> =
        pet_items.iter().map(|i| i as &dyn tauri::menu::IsMenuItem<tauri::Wry>).collect();
    let pets_menu = Submenu::with_items(app, "Choose pet", true, &pet_refs)?;

    let mut radios = Vec::new();
    let size_menu = radio_group(app, "Size", &SIZES, &mut radios)?;
    let speed_menu = radio_group(app, "Speed", &SPEEDS, &mut radios)?;
    let break_menu = radio_group(app, "Break reminder", &BREAKS, &mut radios)?;

    let follow = CheckMenuItem::with_id(app, "toggle:follow", "Follow cursor", true, true, None::<&str>)?;
    let mischief =
        CheckMenuItem::with_id(app, "toggle:mischief", "Mischief mode", true, false, None::<&str>)?;
    let real_click =
        CheckMenuItem::with_id(app, "toggle:realclick", "Use real mouse clicks", true, false, None::<&str>)?;
    let minimize_active =
        MenuItem::with_id(app, "act:minimize", "Pet: minimise active window", true, None::<&str>)?;
    let close_active =
        MenuItem::with_id(app, "act:close", "Pet: close active window", true, None::<&str>)?;
    let say = MenuItem::with_id(app, "act:say", "Pet: say something", true, None::<&str>)?;
    let feed = MenuItem::with_id(app, "act:feed", "Pet: feed", true, None::<&str>)?;
    let ball = MenuItem::with_id(app, "act:ball", "Pet: throw toy", true, None::<&str>)?;
    let game_jump = MenuItem::with_id(app, "act:game:jump", "Pet: obstacle jump", true, None::<&str>)?;
    let game_hide = MenuItem::with_id(app, "act:game:hide", "Pet: hide & seek", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "app:settings", "Settings...", true, None::<&str>)?;
    let autostart = CheckMenuItem::with_id(
        app,
        "toggle:autostart",
        "Run at startup",
        true,
        startup::autostart_enabled(),
        None::<&str>,
    )?;
    let hide = CheckMenuItem::with_id(
        app,
        "toggle:hide",
        format!("Hide pet  ({})", startup::HOTKEY_LABEL),
        true,
        false,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "app:quit", "Quit PocketPet", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &pets_menu,
            &size_menu,
            &speed_menu,
            &break_menu,
            &PredefinedMenuItem::separator(app)?,
            &follow,
            &mischief,
            &real_click,
            &PredefinedMenuItem::separator(app)?,
            &say,
            &feed,
            &ball,
            &game_jump,
            &game_hide,
            &minimize_active,
            &close_active,
            &PredefinedMenuItem::separator(app)?,
            &autostart,
            &hide,
            &PredefinedMenuItem::separator(app)?,
            &settings_item,
            &quit,
        ],
    )?;

    if let Some(tray) = app.tray_by_id("pocketpet-tray") {
        tray.set_menu(Some(menu))?;
        tray.set_show_menu_on_left_click(true)?;
    }
    Ok(TrayToggles { follow, mischief, real_click, autostart, hide, radios })
}

// --- entry point -------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(HitRegions::default())
        .manage(LastForeground::default())
        .manage(Flags {
            interactive: AtomicBool::new(true),
            hidden: AtomicBool::new(false),
            capture_all: AtomicBool::new(false),
        })
        .invoke_handler(tauri::generate_handler![
            get_screen,
            set_hit_regions,
            set_interactive,
            set_capture_all,
            list_windows,
            get_foreground_window,
            get_caption_buttons,
            press_caption_button,
            get_autostart,
            set_autostart,
            set_hidden,
            sync_tray,
            pick_image,
            notify,
            open_settings,
            get_environment,
            set_hotkeys,
            save_backup,
            load_backup,
            quit_app,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            if let Some(window) = app.get_webview_window("overlay") {
                configure_overlay(&window)?;
            }
            let toggles = build_tray(&handle)?;
            app.manage(toggles);
            spawn_cursor_thread(handle.clone());
            // Default binding until the frontend loads the user's own set.
            let default = startup::parse_combo(startup::HOTKEY_LABEL)
                .map(|c| vec![(startup::HotkeyAction::Toggle, c)])
                .unwrap_or_default();
            startup::spawn_hotkey_thread(handle, default, on_hotkey);
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref().to_string();
            if id == "app:quit" {
                app.exit(0);
                return;
            }
            if id == "app:settings" {
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = open_settings(app).await;
                });
                return;
            }
            // Handled entirely on this side; the frontend only needs to know
            // about `hidden`, and apply_hidden tells it.
            if id == "toggle:autostart" || id == "toggle:hide" {
                let checked = app
                    .try_state::<TrayToggles>()
                    .and_then(|t| {
                        let item = if id == "toggle:hide" { &t.hide } else { &t.autostart };
                        item.is_checked().ok()
                    })
                    .unwrap_or(false);
                if id == "toggle:hide" {
                    apply_hidden(app, checked);
                } else {
                    startup::set_autostart(checked);
                }
                return;
            }
            // Radio groups: tick the chosen entry, untick its siblings, then let
            // the frontend apply and persist it.
            if id.starts_with("size:") || id.starts_with("speed:") || id.starts_with("break:") {
                if let Some(t) = app.try_state::<TrayToggles>() {
                    t.select_radio(&id);
                }
            }
            // muda already flipped the tick, so just read the new value back.
            let value = app.try_state::<TrayToggles>().and_then(|t| {
                let item = match id.as_str() {
                    "toggle:follow" => &t.follow,
                    "toggle:mischief" => &t.mischief,
                    "toggle:realclick" => &t.real_click,
                    _ => return None,
                };
                item.is_checked().ok()
            });
            // Everything else is a frontend concern: the pet has to walk over
            // and perform the action, not teleport.
            let _ = app.emit("pet://menu", serde_json::json!({ "id": id, "value": value }));
        })
        .run(tauri::generate_context!())
        .expect("error while running PocketPet");
}
