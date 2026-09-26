//! PocketPet - a desktop pet that lives in a click-through overlay spanning every
//! monitor, walks to your cursor, perches on your windows, and can reach out
//! and press their caption buttons.

mod actions;
mod agent;
mod browser;
mod geom;
mod paths;

// Platform modules share one API: Win32 implementations on Windows, the
// keychain / plugin / "no window access" versions in `unix.rs` elsewhere.
#[cfg(windows)]
mod extras;
#[cfg(windows)]
mod startup;
#[cfg(windows)]
mod titlebar;
#[cfg(windows)]
mod win;
#[cfg(not(windows))]
mod unix;
#[cfg(not(windows))]
use unix::{extras, startup, titlebar, win};

pub use paths::data_dir;

#[cfg(windows)]
use std::ffi::c_void;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};
use tauri_plugin_notification::NotificationExt;

use geom::{CaptionButtons, Rect, WindowInfo};

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

/// A new Tasks webview may not have installed its event listeners yet. Keep
/// hotkey actions until that webview explicitly consumes them.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "lowercase")]
enum TaskIntent {
    Voice,
    Clip { text: String },
}

#[derive(Default)]
struct PendingTaskIntents(Mutex<Vec<TaskIntent>>);

impl PendingTaskIntents {
    fn push(&self, intent: TaskIntent) {
        if let Ok(mut pending) = self.0.lock() {
            pending.push(intent);
        }
    }

    fn take(&self) -> Vec<TaskIntent> {
        self.0.lock().map(|mut pending| std::mem::take(&mut *pending)).unwrap_or_default()
    }
}

/// Runtime toggles that the cursor thread needs to read cheaply.
struct Flags {
    /// When false the overlay is click-through everywhere, so the pet becomes
    /// pure decoration and can never intercept a click.
    interactive: AtomicBool,
    /// Overlay hidden via the tray or the hotkey.
    hidden: AtomicBool,
    /// Keep manual and automatic hiding independent so focus mode never
    /// reveals a pet the user deliberately hid.
    manual_hidden: AtomicBool,
    focus_hidden: AtomicBool,
    low_power: AtomicBool,
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
    #[serde(default)]
    tasks: String,
    #[serde(default)]
    kill: String,
    #[serde(default)]
    voice: String,
    #[serde(default)]
    clip: String,
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

/// Every monitor as (bounds, work area) plus their bounding box, physical pixels.
#[cfg(windows)]
fn screen_layout(_window: &WebviewWindow) -> (Rect, Vec<(Rect, Rect)>) {
    (win::virtual_screen(), extras::monitor_layout())
}

#[cfg(not(windows))]
fn screen_layout(window: &WebviewWindow) -> (Rect, Vec<(Rect, Rect)>) {
    let monitors = window.available_monitors().unwrap_or_default();
    let layout: Vec<(Rect, Rect)> = monitors
        .iter()
        .map(|m| {
            let (p, s, wa) = (m.position(), m.size(), m.work_area());
            (
                Rect { x: p.x, y: p.y, w: s.width as i32, h: s.height as i32 },
                Rect { x: wa.position.x, y: wa.position.y, w: wa.size.width as i32, h: wa.size.height as i32 },
            )
        })
        .collect();
    if layout.is_empty() {
        return (win::virtual_screen(), Vec::new());
    }
    let x = layout.iter().map(|(m, _)| m.x).min().unwrap_or(0);
    let y = layout.iter().map(|(m, _)| m.y).min().unwrap_or(0);
    let right = layout.iter().map(|(m, _)| m.x + m.w).max().unwrap_or(0);
    let bottom = layout.iter().map(|(m, _)| m.y + m.h).max().unwrap_or(0);
    (Rect { x, y, w: right - x, h: bottom - y }, layout)
}

#[tauri::command]
fn get_screen(window: WebviewWindow) -> ScreenInfo {
    let (virtual_screen, layout) = screen_layout(&window);
    let overlay = window.app_handle().get_webview_window("overlay");
    if let Some(overlay) = overlay.as_ref() {
        let wanted_position = PhysicalPosition::new(virtual_screen.x, virtual_screen.y);
        let wanted_size = PhysicalSize::new(virtual_screen.w.max(1) as u32, virtual_screen.h.max(1) as u32);
        if overlay.outer_position().ok() != Some(wanted_position) {
            let _ = overlay.set_position(wanted_position);
        }
        if overlay.outer_size().ok() != Some(wanted_size) {
            let _ = overlay.set_size(wanted_size);
        }
    }
    ScreenInfo {
        virtual_screen,
        scale: overlay.as_ref().unwrap_or(&window).scale_factor().unwrap_or(1.0),
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
    let rect = win::frame_bounds_raw(hwnd)?;
    Some(titlebar::caption_buttons(hwnd, rect))
}

/// Press a caption button on someone else's window.
///
/// `real_click` decides how: the default posts `WM_SYSCOMMAND`, which cannot
/// mis-click and leaves the user's cursor untouched. The opt-in path warps the
/// real mouse to the button and clicks it, which looks more convincing but
/// briefly takes over the pointer.
#[tauri::command]
fn press_caption_button(hwnd: isize, which: String, real_click: bool) -> bool {
    let Some(rect) = win::frame_bounds_raw(hwnd) else {
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

#[tauri::command]
fn set_focus_hidden(hidden: bool, app: AppHandle) {
    if let Some(flags) = app.try_state::<Flags>() {
        flags.focus_hidden.store(hidden, Ordering::Relaxed);
    }
    sync_hidden(&app);
}

#[tauri::command]
fn set_low_power(enabled: bool, flags: State<'_, Flags>) {
    flags.low_power.store(enabled, Ordering::Relaxed);
}

/// The frontend owns the saved settings, so synchronize both radio entries and
/// checkboxes after boot and whenever settings change.
#[tauri::command]
fn sync_tray(
    size: String, speed: String, break_mins: u32,
    follow: Option<bool>, mischief: Option<bool>, real_click: Option<bool>,
    toggle_shortcut: Option<String>, app: AppHandle,
) {
    if let Some(t) = app.try_state::<TrayToggles>() {
        t.select_radio(&format!("size:{size}"));
        t.select_radio(&format!("speed:{speed}"));
        t.select_radio(&format!("break:{break_mins}"));
        if let Some(value) = follow { let _ = t.follow.set_checked(value); }
        if let Some(value) = mischief { let _ = t.mischief.set_checked(value); }
        if let Some(value) = real_click { let _ = t.real_click.set_checked(value); }
        if let Some(shortcut) = toggle_shortcut {
            let label = if shortcut.trim().is_empty() { "Hide pet".to_owned() }
                else { format!("Hide pet  ({shortcut})") };
            let _ = t.hide.set_text(label);
        }
    }
}

/// Native file picker; resolves to a data: URL, null on cancel, Err with a
/// user-facing message otherwise.
#[cfg(windows)]
#[tauri::command]
async fn pick_image() -> Result<Option<String>, String> {
    // Modal dialogs block; keep them off the main thread.
    tauri::async_runtime::spawn_blocking(extras::pick_image)
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(not(windows))]
#[tauri::command]
async fn pick_image() -> Result<Option<String>, String> {
    extras::pick_image().await
}

/// Our overlay's native handle as an integer; 0 where there is no HWND.
fn own_handle(window: &WebviewWindow) -> isize {
    #[cfg(windows)]
    {
        window.hwnd().map(|h| h.0 as isize).unwrap_or(0)
    }
    #[cfg(not(windows))]
    {
        let _ = window;
        0
    }
}

#[tauri::command]
fn get_environment(window: WebviewWindow) -> Environment {
    let ours = own_handle(&window);
    let fg = win::raw_foreground();
    let fullscreen = fg != 0 && win::root_window(fg) != win::root_window(ours) && win::is_fullscreen(fg);
    Environment { fullscreen, on_battery: win::on_battery() }
}

/// Re-register the global hotkeys from the user's settings. Returns the
/// names of actions whose combination could not be parsed or registered.
#[tauri::command]
async fn set_hotkeys(shortcuts: Shortcuts) -> Result<Vec<String>, String> {
    use startup::{parse_combo, HotkeyAction};
    let mut bindings = Vec::new();
    let mut bad = Vec::new();
    for (name, text, action) in [
        ("toggle", &shortcuts.toggle, HotkeyAction::Toggle),
        ("feed", &shortcuts.feed, HotkeyAction::Feed),
        ("play", &shortcuts.play, HotkeyAction::Play),
        ("settings", &shortcuts.settings, HotkeyAction::Settings),
        ("tasks", &shortcuts.tasks, HotkeyAction::Tasks),
        ("kill", &shortcuts.kill, HotkeyAction::Kill),
        ("voice", &shortcuts.voice, HotkeyAction::Voice),
        ("clip", &shortcuts.clip, HotkeyAction::Clip),
    ] {
        if text.trim().is_empty() {
            continue; // unbound on purpose
        }
        match parse_combo(text) {
            Some(combo) => bindings.push((action, combo)),
            None => bad.push(name.to_string()),
        }
    }
    let failed = tauri::async_runtime::spawn_blocking(move || startup::set_hotkeys(bindings))
        .await.map_err(|error| error.to_string())?;
    bad.extend(failed.into_iter().map(|action| match action {
        HotkeyAction::Toggle => "toggle", HotkeyAction::Feed => "feed",
        HotkeyAction::Play => "play", HotkeyAction::Settings => "settings",
        HotkeyAction::Tasks => "tasks", HotkeyAction::Kill => "kill",
        HotkeyAction::Voice => "voice", HotkeyAction::Clip => "clip",
    }.to_owned()));
    Ok(bad)
}

#[cfg(windows)]
#[tauri::command]
async fn save_backup(json: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || extras::save_backup(&json))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(not(windows))]
#[tauri::command]
async fn save_backup(json: String) -> Result<Option<String>, String> {
    extras::save_backup(json).await
}

#[cfg(windows)]
#[tauri::command]
async fn load_backup() -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(extras::load_backup)
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(not(windows))]
#[tauri::command]
async fn load_backup() -> Result<Option<String>, String> {
    extras::load_backup().await
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
        .inner_size(440.0, 680.0)
        .min_inner_size(380.0, 480.0)
        .maximizable(false)
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// --- task agent ----------------------------------------------------------------

#[derive(Serialize)]
struct ProviderInfo {
    id: &'static str,
    needs_key: bool,
    base_url: &'static str,
    default_model: &'static str,
    has_key: bool,
}

#[tauri::command]
fn agent_providers() -> Vec<ProviderInfo> {
    agent::PROVIDERS
        .iter()
        .map(|p| ProviderInfo {
            id: p.id,
            needs_key: p.needs_key,
            base_url: p.base_url,
            default_model: p.default_model,
            has_key: agent::read_key(p.id).is_some(),
        })
        .collect()
}

#[tauri::command]
fn agent_set_key(provider: String, key: String) -> Result<(), String> {
    if key.trim().is_empty() {
        agent::delete_key(&provider);
        return Ok(());
    }
    agent::store_key(&provider, key.trim())
}

#[tauri::command]
fn agent_delete_key(provider: String) -> bool {
    agent::delete_key(&provider)
}

#[tauri::command]
async fn agent_models(provider: String, base_url: String) -> Result<Vec<String>, String> {
    agent::list_models(&provider, &base_url).await
}

#[tauri::command]
fn agent_run(req: agent::RunRequest, app: AppHandle, tasks: State<'_, Arc<agent::Tasks>>) -> String {
    let id = req.id.clone();
    let tasks = tasks.inner().clone();
    tauri::async_runtime::spawn(agent::run(app, tasks, req));
    id
}

#[tauri::command]
fn agent_cancel(id: String, tasks: State<'_, Arc<agent::Tasks>>) -> bool {
    agent::cancel(&tasks, &id)
}

#[tauri::command]
fn agent_pause(id: String, paused: bool, tasks: State<'_, Arc<agent::Tasks>>) -> bool {
    agent::set_paused(&tasks, &id, paused)
}

/// Answer a pending ask_user / confirmation for a task.
#[tauri::command]
fn agent_reply(id: String, text: String, tasks: State<'_, Arc<agent::Tasks>>) -> bool {
    agent::reply(&tasks, &id, &text)
}

#[tauri::command]
async fn agent_close_browser(tasks: State<'_, Arc<agent::Tasks>>) -> Result<bool, String> {
    let mut g = tasks.browser.lock().await;
    if let Some(b) = g.take() {
        b.close().await;
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
fn memory_read() -> String {
    agent::memory_read()
}

#[tauri::command]
fn memory_write(text: String) -> Result<(), String> {
    agent::memory_write(&text)
}

#[tauri::command]
async fn agent_transcribe(audio_b64: String, mime: String) -> Result<String, String> {
    agent::transcribe(&audio_b64, &mime).await
}

/// Offline dictation via Windows' recogniser; blocks until the user pauses.
#[tauri::command]
async fn windows_listen() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(agent::windows_listen).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn agent_kill(app: AppHandle) {
    kill_everything(&app).await;
}

/// Open a site in the pet's browser with no agent running, so the user can
/// sign in once; the session then persists in that profile.
#[tauri::command]
async fn agent_open_site(url: String, tasks: State<'_, Arc<agent::Tasks>>) -> Result<(), String> {
    let mut g = tasks.browser.lock().await;
    if g.is_none() {
        *g = Some(browser::Browser::launch().await?);
    }
    g.as_ref().unwrap().navigate(&url).await.map(|_| ())
}

#[tauri::command]
fn open_task_log(id: String) -> bool {
    let p = agent::task_log_path(&id);
    p.exists() && open_path(&p.display().to_string())
}

#[tauri::command]
fn open_logs_folder() -> bool {
    let dir = agent::data_dir();
    let _ = std::fs::create_dir_all(dir.join("logs"));
    let _ = std::fs::create_dir_all(dir.join("tasks"));
    open_path(&dir.display().to_string())
}

#[tauri::command]
fn build_identity() -> String {
    format!("PocketPet {} · build {} ({})", env!("CARGO_PKG_VERSION"), env!("POCKETPET_REVISION"), env!("POCKETPET_BUILD_PROFILE"))
}

/// Build, OS, providers with keys (never the keys), recent panics — for a bug report.
#[tauri::command]
fn diagnostics() -> String {
    let mut out = format!("{}\n{} {}\n", build_identity(), std::env::consts::OS, std::env::consts::ARCH);
    let keyed: Vec<&str> = agent::PROVIDERS.iter().filter(|p| agent::read_key(p.id).is_some()).map(|p| p.id).collect();
    out.push_str(&format!("Providers with keys: {}\n", if keyed.is_empty() { "none".to_string() } else { keyed.join(", ") }));
    let logs = agent::data_dir().join("logs");
    if let Ok(rd) = std::fs::read_dir(&logs) {
        let mut files: Vec<_> = rd.flatten().map(|e| e.path()).collect();
        files.sort();
        for p in files.iter().rev().take(3) {
            if let Ok(t) = std::fs::read_to_string(p) {
                out.push_str(&format!("\n--- {} ---\n{}", p.file_name().and_then(|n| n.to_str()).unwrap_or(""), t.chars().take(2000).collect::<String>()));
            }
        }
    }
    out
}

#[tauri::command]
async fn check_update() -> Result<extras::UpdateInfo, String> {
    extras::check_update().await
}

/// Download the installer, launch it, and quit so it can replace the exe.
#[cfg(windows)]
#[tauri::command]
async fn install_update(url: String, app: AppHandle) -> Result<String, String> {
    let path = extras::download_update(&url).await?;
    if !open_path(&path.display().to_string()) {
        return Err("Could not start the installer.".into());
    }
    tokio::time::sleep(std::time::Duration::from_millis(800)).await;
    app.exit(0);
    Ok(String::new())
}

/// macOS mounts the .dmg; Linux gets an executable AppImage in a revealed
/// folder. Replacing the running app is the user's step here, so PocketPet
/// stays open and says where the update went.
#[cfg(not(windows))]
#[tauri::command]
async fn install_update(url: String, app: AppHandle) -> Result<String, String> {
    let _ = app;
    let path = extras::download_update(&url).await?;
    #[cfg(target_os = "linux")]
    let target = {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).map_err(|e| e.to_string())?;
        path.parent().map(|p| p.display().to_string()).unwrap_or_default()
    };
    #[cfg(not(target_os = "linux"))]
    let target = path.display().to_string();
    if !open_path(&target) {
        return Err(format!("Downloaded to {}, but could not open it.", path.display()));
    }
    Ok(format!("Downloaded to {}. Quit PocketPet and replace the old app with it.", path.display()))
}

#[cfg(windows)]
fn open_path(target: &str) -> bool {
    use windows::core::HSTRING;
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
    let verb = HSTRING::from("open");
    let target = HSTRING::from(target);
    let h = unsafe { ShellExecuteW(None, &verb, &target, None, None, SW_SHOWNORMAL) };
    (h.0 as isize) > 32
}

/// `open` on macOS, `xdg-open` elsewhere: files, folders and URLs alike.
#[cfg(not(windows))]
fn open_path(target: &str) -> bool {
    let program = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
    std::process::Command::new(program).arg(target).spawn().is_ok()
}

/// HWND + rect of the top-level window belonging to a process, for the pet to
/// go and sit on the browser.
#[tauri::command]
fn window_for_pid(pid: u32) -> Option<WindowInfo> {
    win::window_for_pid(pid)
}

#[tauri::command]
async fn open_tasks(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("tasks") {
        let _ = existing.unminimize();
        let _ = existing.set_focus();
        return Ok(());
    }
    WebviewWindowBuilder::new(&app, "tasks", WebviewUrl::App("tasks.html".into()))
        .title("PocketPet tasks")
        .inner_size(520.0, 680.0)
        .min_inner_size(380.0, 420.0)
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn consume_task_intents(window: WebviewWindow, pending: State<'_, PendingTaskIntents>) -> Vec<TaskIntent> {
    if window.label() != "tasks" { return Vec::new(); }
    pending.take()
}

fn dispatch_task_intent(app: &AppHandle, intent: TaskIntent) {
    if let Some(pending) = app.try_state::<PendingTaskIntents>() {
        pending.push(intent);
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if open_tasks(app.clone()).await.is_ok() {
            // This is only a wake-up signal. Startup also drains the queue, so
            // a signal sent before listeners exist cannot lose an action.
            let _ = app.emit_to("tasks", "pet://task-intents", ());
        }
    });
}

/// Open a link in the user's default browser (the task answers are full of them).
#[tauri::command]
fn open_external(url: String) -> bool {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return false;
    }
    open_path(&url)
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

/// Hide or show the overlay and keep the tray tick and the frontend in step.
/// Called from the tray, the hotkey thread and the pet's own menu.
fn apply_hidden(app: &AppHandle, hidden: bool) {
    if let Some(flags) = app.try_state::<Flags>() {
        flags.manual_hidden.store(hidden, Ordering::Relaxed);
    }
    if let Some(t) = app.try_state::<TrayToggles>() {
        let _ = t.hide.set_checked(hidden);
    }
    sync_hidden(app);
}

fn sync_hidden(app: &AppHandle) {
    let Some(flags) = app.try_state::<Flags>() else { return };
    let hidden = flags.manual_hidden.load(Ordering::Relaxed)
        || flags.focus_hidden.load(Ordering::Relaxed);
    if flags.hidden.swap(hidden, Ordering::Relaxed) == hidden {
        return;
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
        .map(|f| f.manual_hidden.load(Ordering::Relaxed))
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
        Tasks => {
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                let _ = open_tasks(app).await;
            });
        }
        Kill => {
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                kill_everything(&app).await;
            });
        }
        Voice => {
            dispatch_task_intent(app, TaskIntent::Voice);
        }
        Clip => {
            let text = extras::clipboard_text().unwrap_or_default();
            dispatch_task_intent(app, TaskIntent::Clip { text });
        }
    }
}

/// Kill switch: cancel every task, close the pet's browser, tell the windows.
async fn kill_everything(app: &AppHandle) {
    if let Some(tasks) = app.try_state::<Arc<agent::Tasks>>() {
        let n = agent::cancel_all(&tasks);
        let mut g = tasks.browser.lock().await;
        if let Some(b) = g.take() {
            b.close().await;
        }
        let _ = app.emit("pet://task", serde_json::json!({ "id": "*", "kind": "killed", "text": format!("{n} task(s) stopped, browser closed") }));
    }
}

// --- overlay plumbing --------------------------------------------------------

/// Stretch the overlay across every monitor and mark it as a non-activating
/// tool window, so it never steals focus, never appears in Alt-Tab, and never
/// shows up in the taskbar.
fn configure_overlay(window: &WebviewWindow) -> tauri::Result<()> {
    let (vs, _) = screen_layout(window);
    window.set_position(PhysicalPosition::new(vs.x, vs.y))?;
    window.set_size(PhysicalSize::new(vs.w.max(1) as u32, vs.h.max(1) as u32))?;
    window.set_ignore_cursor_events(true)?;
    // Follow the user across Spaces / virtual desktops (no-op on Windows).
    #[cfg(not(windows))]
    let _ = window.set_visible_on_all_workspaces(true);

    #[cfg(windows)]
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
        #[cfg(not(windows))]
        let device = device_query::DeviceState::new();

        loop {
            let delay = app.try_state::<Flags>().map(|flags| {
                if flags.hidden.load(Ordering::Relaxed) { 150 }
                else if flags.low_power.load(Ordering::Relaxed) { 45 }
                else { 16 }
            }).unwrap_or(45);
            std::thread::sleep(Duration::from_millis(delay));

            let Some(window) = app.get_webview_window("overlay") else {
                continue;
            };
            #[cfg(windows)]
            let (x, y) = win::cursor_pos();
            #[cfg(not(windows))]
            let (x, y) = {
                // macOS reports points; the overlay works in physical pixels.
                let (cx, cy) = win::read_cursor(&device);
                let scale = if cfg!(target_os = "macos") { window.scale_factor().unwrap_or(1.0) } else { 1.0 };
                let p = ((cx as f64 * scale).round() as i32, (cy as f64 * scale).round() as i32);
                win::publish_cursor(p.0, p.1);
                p
            };

            let ours = own_handle(&window);
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

const PETS: [(&str, &str); 5] =
    [("droplet", "Droplet"), ("cat", "Cat"), ("duck", "Duck"), ("panda", "Panda"), ("penguin", "Penguin")];

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
    let tasks_item = MenuItem::with_id(app, "app:tasks", "Ask me to do something...", true, None::<&str>)?;
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
        format!("Hide pet  ({})", actions::HOTKEY_LABEL),
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
            &tasks_item,
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
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_window_state::Builder::default().build());
    // Windows registers hotkeys itself (RegisterHotKey thread); the others go
    // through the global-shortcut plugin.
    #[cfg(not(windows))]
    let builder = builder.plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(|app, shortcut, event| startup::handle(app, shortcut, event.state()))
            .build(),
    );
    builder
        .manage(HitRegions::default())
        .manage(Arc::new(agent::Tasks::default()))
        .manage(LastForeground::default())
        .manage(PendingTaskIntents::default())
        .manage(Flags {
            interactive: AtomicBool::new(true),
            hidden: AtomicBool::new(false),
            manual_hidden: AtomicBool::new(false),
            focus_hidden: AtomicBool::new(false),
            low_power: AtomicBool::new(false),
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
            set_focus_hidden,
            set_low_power,
            sync_tray,
            pick_image,
            notify,
            open_settings,
            get_environment,
            set_hotkeys,
            save_backup,
            load_backup,
            agent_providers,
            agent_set_key,
            agent_delete_key,
            agent_models,
            agent_run,
            agent_cancel,
            agent_pause,
            agent_reply,
            agent_close_browser,
            memory_read,
            memory_write,
            agent_transcribe,
            windows_listen,
            agent_kill,
            agent_open_site,
            open_task_log,
            open_logs_folder,
            build_identity,
            diagnostics,
            check_update,
            install_update,
            window_for_pid,
            open_tasks,
            consume_task_intents,
            open_external,
            quit_app,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            // Tray-only app: no Dock icon, no app menu.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            if let Some(window) = app.get_webview_window("overlay") {
                configure_overlay(&window)?;
            }
            let toggles = build_tray(&handle)?;
            app.manage(toggles);
            spawn_cursor_thread(handle.clone());
            // Default binding until the frontend loads the user's own set.
            let default = startup::parse_combo(actions::HOTKEY_LABEL)
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
            if id == "app:tasks" {
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = open_tasks(app).await;
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

#[cfg(test)]
mod native_tests {
    use super::*;

    #[test]
    fn task_hotkeys_survive_window_startup_and_are_consumed_once_in_order() {
        let pending = PendingTaskIntents::default();
        pending.push(TaskIntent::Voice);
        pending.push(TaskIntent::Clip { text: "clipboard before startup".into() });
        assert_eq!(pending.take(), vec![TaskIntent::Voice,
            TaskIntent::Clip { text: "clipboard before startup".into() }]);
        assert!(pending.take().is_empty(), "the wake-up event must not repeat startup actions");
        pending.push(TaskIntent::Clip { text: "later clipboard".into() });
        assert_eq!(pending.take(), vec![TaskIntent::Clip { text: "later clipboard".into() }]);
    }
}
