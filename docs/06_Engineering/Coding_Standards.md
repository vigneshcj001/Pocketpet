# Coding Standards

## Rust
- Edition 2021; `cargo fmt` defaults; no warnings on `cargo check` (CI treats warnings as review items).
- `unsafe` only around Win32/WinRT calls, in the smallest block, with a comment on the invariant.
- Errors as `Result<_, String>` at the command boundary with user-readable messages; no `unwrap` on external data.
- Long-running/dialog commands are `async` (`spawn_blocking` for blocking APIs).
- Regex via `regex-lite`; compile inside the function unless hot.
- Comments explain *why* (see existing style); module docs at the top of each file.

## JavaScript
- ES modules, no bundler, no framework; `const`/`let`; template literals.
- All persisted state through `preferences.js` (`readSettings`/`writeSettings`); never `localStorage.setItem` elsewhere except `STORAGE_KEY` resets.
- DOM built with `createElement`; `textContent` for user/model text (no `innerHTML` with untrusted strings).
- Event listeners registered once at module top; guards `state.mode === "free"`, `!state.hidden`, `!state.quiet` for autonomous behaviour.
- Files: `main.js` (overlay), `settings.js`, `tasks.js`, pure logic in `preferences.js` / `behavior.js` / `games.js`.

## Naming
- Commands `snake_case`; JS args camelCase (Tauri converts); nested structs `rename_all = "camelCase"`.
- Events `pet://<topic>`.
- Settings keys camelCase; provider ids lowercase.

## Tests
- Every gate/regex/parser has a unit test next to it.
- Pure JS modules have `node --test` coverage; the DOM/ids check test must pass after UI changes.

## Commits
Imperative subject ≤ 72 chars, body explains why and any user-visible change; trailer `Co-Authored-By` when AI-assisted.
