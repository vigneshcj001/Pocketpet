# Audit Logging

Per task: `%LOCALAPPDATA%\PocketPet\tasks\<id>.log`, TSV lines `epoch<TAB>kind<TAB>text`.

Logged kinds: task (the request), start, tool, result, note, plan, step, shot (label only), browser, confirm, ask, answer, error, cancelled. Not logged: delta (stream), usage, act (coordinates).

Approvals: the `confirm` line records the exact question ("About to click … on host …"); the reply is implied by the next action (a following `tool click` = allowed; an `error … declined` = denied). Candidate improvement: log the reply explicitly.

Crash logs: `logs/panic-<ts>.log`. Diagnostics: Settings › Backup › Copy diagnostics.

Retention: forever until the user deletes; no rotation in 0.1 (candidate: keep last 200 tasks).
