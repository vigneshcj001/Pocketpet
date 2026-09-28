# Codebase review — 2026-09-28

Scope: the desktop frontend, native overlay and shortcuts, browser/task agent,
settings and migrations, and build/release workflow. This is a code review and
regression pass, not an exhaustive security audit.

## Confirmed issues addressed

- **Old installed/downloaded code:** pushing `main` builds CI artifacts but does
  not publish a release or replace an installed executable. Version 0.2.0,
  visible build identity, frontend rebuild tracking, version/tag validation,
  and failure-aware installer scripts make the distinction explicit.
- **Incomplete release assets:** release publication now waits for every
  platform, uploads to a draft, and includes nested Linux artifact directories.
- **Overlay and settings:** speech bubbles no longer shrink to the pet's width;
  a pending fade cannot hide a new message. Roaming uses the current monitor's
  work area. Tray toggles follow saved settings. The second pet receives clicks.
- **Custom images:** replacing artwork under an existing pet ID repaints it;
  unchanged sprites retain their animation. Removing a migrated custom pet no
  longer restores it from the old image field on the next settings read.
- **Task shortcuts:** actions survive Tasks-window startup, drain after listeners
  are installed, and are consumed once. Malformed shortcuts are rejected and
  registration failures are returned to the frontend. Completed the native
  return types that were missing in commit `416579d`.
- **Browser actions:** secret form values are redacted from numbered snapshots.
  Keyboard/form submission uses approval checks, including generically labelled
  submit buttons. References are checked again after approval, and uncertain
  click results are not automatically retried.
- **Agent and updater:** cancellation interrupts a pending request instead of
  reporting a late success; malformed Unicode URL escapes do not panic; HTTP
  failures during update checks/downloads are surfaced as errors.

## Verification

- JavaScript: 19 regression tests pass; all 21 JavaScript files parse.
- Rust on Windows: 15 tests pass; one existing network search test is ignored.
- App/config/lockfile versions match; Git diff whitespace validation passes.

## Limits

macOS and Linux were reviewed in source but need their CI builds and runtime
checks. Paid provider, microphone, and third-party transaction flows were not
run. GitHub's latest public release was still `v0.1.0` when checked: a matching
`v0.2.0` tag must be pushed after the final fixes are committed to publish new
downloads. Existing published tags should not be moved.
