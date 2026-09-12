// Hide the console window in release builds; the overlay is the only UI.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    pocketpet_lib::run()
}
