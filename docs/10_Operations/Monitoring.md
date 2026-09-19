# Monitoring

Local-only signals (no telemetry):

| Signal | Where | What to look for |
|--------|-------|------------------|
| Task outcomes | Tasks › History; `tasks/<id>.log` | error rate, repeated "declined", timeouts |
| Spend | Tasks › Limits & sites (today), `usage` events | approaching cap, unexpected cost per task |
| Crashes | `<data dir>/logs/panic-*.log` | any file = investigate |
| Provider health | error text in task log ("429", "5xx", "no longer available") | switch model/provider |
| Browser | orphan `msedge.exe` / `chrome` / `chromium` with `--user-data-dir=…/PocketPet/browser` | Stop all / Close the pet's browser |
| CI | `Build installers` workflow red on any OS | fix before tagging; `fail-fast: false` keeps the other packages |
| Performance | Task Manager CPU/RSS | > 3 % idle → check low-power, window count |

Diagnostics bundle: Settings › Backup › Copy diagnostics.
