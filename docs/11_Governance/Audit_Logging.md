# Audit Logging

Per task: `<data dir>/tasks/<id>.log` (`%LOCALAPPDATA%\PocketPet` · `~/Library/Application Support/PocketPet` · `$XDG_DATA_HOME/PocketPet`), TSV lines `epoch<TAB>kind<TAB>text`.

Every `pet://task` event is appended except `delta` (stream), `usage` and `act` (coordinates). Logged kinds include: start, tool, result, note, plan, step, shot (label only), browser, confirm, ask, answer, error, cancelled. The kill switch broadcasts `killed` to the windows but writes no per-task line; each cancelled task logs `cancelled`. Newlines in a line are written as ` ⏎ `.

Approvals: the `confirm` line records the exact question ("About to click … on host …"); the reply is implied by the next action (a following `tool click` = allowed; an `error … declined` = denied). Candidate improvement: log the reply explicitly.

Crash logs: `logs/panic-<ts>.log`. Diagnostics: Settings › About & updates › Copy diagnostics.

Retention: until the user deletes them; Settings › Backup › **Clear logs** (asks first) removes every `.log` file under `tasks/` and `logs/` (other files untouched). No automatic rotation yet (candidate: keep last 200 tasks).
