# Non-Functional Requirements

| ID | Category | Requirement | Verification |
|----|----------|-------------|--------------|
| NFR-1 | Performance | Overlay idle CPU ≤ 3 % at 60 fps on integrated graphics; ≤ 1 % in low-power. | Task Manager over 10 min idle |
| NFR-2 | Performance | Hit-region IPC only when regions change; window scan every 0.7 s (2 s low-power). | code review; log counters |
| NFR-3 | Latency | First streamed token < 2 s on hosted providers; `read_page` < 400 ms on typical pages. | eval timings |
| NFR-4 | Cost | Research task < $0.05; browser task < $0.30 with digest model; hard daily cap. | spend meter, eval results |
| NFR-5 | Reliability | No unhandled panic without a log; agent errors surfaced verbatim; streaming falls back to non-streaming once. | panic hook, logs |
| NFR-6 | Security | Keys only in the OS keychain (Credential Manager / Keychain / Secret Service); all provider traffic from Rust; CSP `default-src 'self'; connect-src ipc: http://ipc.localhost`; updates only from GitHub hosts. | code review, `09_Security` |
| NFR-7 | Privacy | No telemetry; diagnostics never include key values; backups exclude keys. | code review |
| NFR-8 | Safety | Commitment actions gated in code; secrets never typed; kill switch < 1 s. | `07_Testing/Security_Testing.md` |
| NFR-9 | Usability | Every control reachable by keyboard; speech size/duration adjustable; read-aloud. | manual |
| NFR-10 | Compatibility | Windows 10 21H2+ / 11 x64 (WebView2 Evergreen); macOS 11+ (aarch64 and x64); Linux x86-64 with WebKitGTK 4.1 on X11/XWayland. Edge/Chrome/Brave/Chromium for the driver. | install matrix, CI matrix |
| NFR-11 | Maintainability | Pure logic in testable modules (`preferences.js`, `behavior.js`, `games.js`, Rust gate fns); tests run in CI. | CI green |
| NFR-12 | Observability | Per-task audit log; crash logs; diagnostics text. | `10_Operations/Monitoring.md` |
| NFR-13 | Portability of data | Backup/restore JSON works across machines of the same major version. | manual |
| NFR-14 | Localisation | English only in 0.x; strings centralised per window file. | — |
