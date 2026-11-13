// Which desktop OS the webview runs on, for wording and for greying out
// Windows-only features. WebView2 says "Windows", WKWebView "Macintosh",
// WebKitGTK "X11; Linux". No DOM dependency, so tests can import it.
const ua = globalThis.navigator?.userAgent ?? "";

/** @type {"windows" | "mac" | "linux"} */
export const OS = /Windows/i.test(ua) ? "windows" : /Mac/i.test(ua) ? "mac" : "linux";
export const IS_WINDOWS = OS === "windows";

export function platformFor(os = OS) {
  return {
    windows: {
      keyStore: "Windows Credential Manager under PocketPet/<provider>",
      voiceHint: "Windows recognition needs Settings › Privacy › Microphone and Speech turned on for desktop apps.",
      superKey: "Win",
    },
    mac: {
      keyStore: "the macOS Keychain (service “PocketPet”)",
      voiceHint: "Offline recognition is Windows-only; use Whisper. macOS asks for microphone access the first time.",
      superKey: "⌘",
    },
    linux: {
      keyStore: "the Secret Service keyring (GNOME Keyring / KWallet), or a private 0600 file in the data folder when no keyring is running",
      voiceHint: "Offline recognition is Windows-only; use Whisper. The microphone needs PipeWire or PulseAudio.",
      superKey: "Super",
    },
  }[os];
}

/**
 * A recording format this webview can produce and Whisper accepts.
 * WebView2 and WebKitGTK record WebM/Ogg; macOS WKWebView only records MP4.
 * Returns the bare MIME type (no codec parameter) or "" when none works.
 */
export function recordingMime(isTypeSupported = globalThis.MediaRecorder?.isTypeSupported?.bind(globalThis.MediaRecorder)) {
  if (typeof isTypeSupported !== "function") return "";
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"]) {
    if (isTypeSupported(type)) return type;
  }
  return "";
}
