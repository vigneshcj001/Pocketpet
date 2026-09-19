// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Crashes go to a file the "Open logs folder" button can reach.
    std::panic::set_hook(Box::new(|info| {
        let dir = pocketpet_lib::data_dir().join("logs");
        let _ = std::fs::create_dir_all(&dir);
        let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
        let _ = std::fs::write(dir.join(format!("panic-{ts}.log")), format!("{info}\n"));
        eprintln!("{info}");
    }));
    pocketpet_lib::run()
}
