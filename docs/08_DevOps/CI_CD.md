# CI/CD

Workflow: `.github/workflows/build.yml` (windows-latest).

Steps: checkout → stable Rust + cache → Node 22 → `node --test tests/features.test.mjs` → `cargo test --lib` → install `tauri-cli` → `cargo tauri build` → upload artifact `PocketPet-setup` → on tag `v*`: create GitHub Release with the installer and generated notes.

Local equivalents: `run.ps1` (debug), `build-installer.ps1` (installer, also installs `tauri-cli` once).

Secrets: none required. Code signing: not configured (candidate: `SIGNTOOL` step with a cert secret).

Branch protection (recommended): require the workflow to pass before merging to `main`.
