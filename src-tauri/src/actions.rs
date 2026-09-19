//! Actions a global hotkey can trigger. Shared by the Windows `RegisterHotKey`
//! thread and the plugin-based registration on other platforms.

/// The numeric value doubles as the Win32 hotkey id.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HotkeyAction {
    Toggle = 1,
    Feed = 2,
    Play = 3,
    Settings = 4,
    Tasks = 5,
    Kill = 6,
    Voice = 7,
    Clip = 8,
}

impl HotkeyAction {
    pub fn from_id(id: i32) -> Option<Self> {
        match id {
            1 => Some(Self::Toggle),
            2 => Some(Self::Feed),
            3 => Some(Self::Play),
            4 => Some(Self::Settings),
            5 => Some(Self::Tasks),
            6 => Some(Self::Kill),
            7 => Some(Self::Voice),
            8 => Some(Self::Clip),
            _ => None,
        }
    }
}

/// Default combination for hide/show, for menus and first-run settings.
pub const HOTKEY_LABEL: &str = "Ctrl+Alt+P";
